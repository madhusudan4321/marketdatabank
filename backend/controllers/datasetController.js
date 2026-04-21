const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const Dataset = require('../models/Dataset');
const { cloudinary } = require('../config/cloudinary');

// GET /api/datasets — list ONLY approved datasets (public)
const getDatasets = async (req, res) => {
  try {
    const { search, tag } = req.query;
    let query = { status: 'approved' }; // only approved shown publicly

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (tag) {
      query.tags = { $regex: tag, $options: 'i' };
    }

    const datasets = await Dataset.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(datasets);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch datasets.' });
  }
};

// GET /api/datasets/pending — admin only: all pending submissions
const getPendingDatasets = async (req, res) => {
  try {
    const datasets = await Dataset.find({ status: 'pending' })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(datasets);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending datasets.' });
  }
};

// PATCH /api/datasets/:id/approve — admin only
const approveDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });
    if (dataset.status === 'approved') {
      return res.status(400).json({ message: 'Dataset is already approved.' });
    }
    dataset.status = 'approved';
    dataset.rejectionReason = '';
    await dataset.save();
    res.json({ message: 'Dataset approved successfully.', dataset });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve dataset.' });
  }
};

// PATCH /api/datasets/:id/reject — admin only
const rejectDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found.' });
    dataset.status = 'rejected';
    dataset.rejectionReason = req.body.reason || 'Does not meet platform standards.';
    await dataset.save();
    res.json({ message: 'Dataset rejected.', dataset });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject dataset.' });
  }
};

// GET /api/datasets/:id — single dataset detail
const getDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found.' });
    }
    // Non-admin users can only see approved datasets in detail view
    if (dataset.status !== 'approved') {
      const requestingUserId = req.user?._id?.toString();
      const ownerId = dataset.uploadedBy?._id?.toString() || dataset.uploadedBy?.toString();
      const isAdmin = req.user?.role === 'admin';
      const isOwner = requestingUserId === ownerId;
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: 'This dataset is not yet approved.' });
      }
    }
    res.json(dataset);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch dataset.' });
  }
};

// POST /api/datasets — upload new dataset
// req.file from multer-storage-cloudinary contains:
//   req.file.path      → the Cloudinary secure URL
//   req.file.filename  → the Cloudinary public_id
const uploadDataset = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a CSV or JSON file.' });
    }

    const { title, description, tags } = req.body;

    if (!title || !description) {
      // Clean up Cloudinary upload if validation fails
      try { await cloudinary.uploader.destroy(req.file.filename, { resource_type: 'raw' }); } catch (_) {}
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const tagsArray = tags
      ? tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    // Admin uploads are auto-approved; regular users go into pending
    const status = req.user.role === 'admin' ? 'approved' : 'pending';

    const dataset = await Dataset.create({
      title,
      description,
      tags: tagsArray,
      fileUrl: req.file.path,          // Cloudinary secure URL
      publicId: req.file.filename,     // Cloudinary public_id (for deletion)
      fileType: ext,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      status,
    });

    const populated = await dataset.populate('uploadedBy', 'name email');
    const statusMsg = status === 'approved'
      ? 'Dataset published successfully.'
      : 'Dataset submitted for admin approval.';

    res.status(201).json({ message: statusMsg, dataset: populated, status });
  } catch (err) {
    // Try to clean up orphaned Cloudinary file
    if (req.file?.filename) {
      try { await cloudinary.uploader.destroy(req.file.filename, { resource_type: 'raw' }); } catch (_) {}
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Failed to upload dataset.' });
  }
};

// DELETE /api/datasets/:id
const deleteDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found.' });
    }

    const isOwner = dataset.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to delete this dataset.' });
    }

    // Delete from Cloudinary (raw resource type for csv/json)
    if (dataset.publicId) {
      try {
        await cloudinary.uploader.destroy(dataset.publicId, { resource_type: 'raw' });
      } catch (cloudErr) {
        console.warn('Cloudinary delete warning:', cloudErr.message);
      }
    }

    await dataset.deleteOne();
    res.json({ message: 'Dataset deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete dataset.' });
  }
};

// GET /api/datasets/:id/download — proxy Cloudinary file + increment count
const downloadDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found.' });
    }
    if (dataset.status !== 'approved') {
      return res.status(403).json({ message: 'This dataset has not been approved yet.' });
    }
    if (!dataset.fileUrl) {
      return res.status(404).json({ message: 'File not found.' });
    }

    await Dataset.findByIdAndUpdate(req.params.id, { $inc: { downloadCount: 1 } });

    const ext = dataset.fileType === 'json' ? 'json' : 'csv';
    const mimeType = ext === 'json' ? 'application/json' : 'text/csv';

    // Proxy the file from Cloudinary so the browser gets a proper download
    const response = await axios.get(dataset.fileUrl, { responseType: 'stream' });

    res.setHeader('Content-Disposition', `attachment; filename="${dataset.title}.${ext}"`);
    res.setHeader('Content-Type', mimeType);
    response.data.pipe(res);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(500).json({ message: 'Failed to download dataset.' });
  }
};

// GET /api/datasets/:id/preview — first 10 rows (fetched from Cloudinary URL)
const previewDataset = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found.' });
    }
    if (!dataset.fileUrl) {
      return res.status(404).json({ message: 'File not found.' });
    }

    // Fetch file content from Cloudinary URL
    const response = await axios.get(dataset.fileUrl, { responseType: 'text' });
    const raw = response.data;

    if (dataset.fileType === 'json') {
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        const firstKey = Object.keys(parsed)[0];
        parsed = Array.isArray(parsed[firstKey]) ? parsed[firstKey] : [parsed];
      }
      const preview = parsed.slice(0, 10);
      const columns = preview.length > 0 ? Object.keys(preview[0]) : [];
      return res.json({ columns, rows: preview, total: parsed.length });
    }

    const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
    const preview = records.slice(0, 10);
    const columns = preview.length > 0 ? Object.keys(preview[0]) : [];
    res.json({ columns, rows: preview, total: records.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to parse dataset preview: ' + err.message });
  }
};

// POST /api/datasets/:id/like — toggle like (approved only)
const toggleLike = async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found.' });
    }
    if (dataset.status !== 'approved') {
      return res.status(403).json({ message: 'Cannot like an unapproved dataset.' });
    }

    const userId = req.user._id.toString();
    const alreadyLiked = dataset.likes.map((id) => id.toString()).includes(userId);

    if (alreadyLiked) {
      dataset.likes = dataset.likes.filter((id) => id.toString() !== userId);
    } else {
      dataset.likes.push(req.user._id);
    }

    await dataset.save();
    res.json({ liked: !alreadyLiked, likesCount: dataset.likes.length, likes: dataset.likes });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update like.' });
  }
};

module.exports = {
  getDatasets,
  getPendingDatasets,
  approveDataset,
  rejectDataset,
  getDataset,
  uploadDataset,
  deleteDataset,
  downloadDataset,
  previewDataset,
  toggleLike,
};
