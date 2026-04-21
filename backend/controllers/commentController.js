const Comment = require('../models/Comment');
const Dataset = require('../models/Dataset');

// GET /api/comments/:datasetId
const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ datasetId: req.params.datasetId })
      .populate('userId', 'name')
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch comments.' });
  }
};

// POST /api/comments
const addComment = async (req, res) => {
  try {
    const { datasetId, comment } = req.body;

    if (!datasetId || !comment) {
      return res.status(400).json({ message: 'datasetId and comment are required.' });
    }

    const dataset = await Dataset.findById(datasetId);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found.' });
    }

    const newComment = await Comment.create({
      datasetId,
      userId: req.user._id,
      comment,
    });

    const populated = await newComment.populate('userId', 'name');
    res.status(201).json(populated);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Failed to add comment.' });
  }
};

// DELETE /api/comments/:id
const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found.' });
    }

    const isOwner = comment.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'You do not have permission to delete this comment.' });
    }

    await comment.deleteOne();
    res.json({ message: 'Comment deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment.' });
  }
};

module.exports = { getComments, addComment, deleteComment };
