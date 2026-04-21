const Dataset = require('../models/Dataset');

// GET /api/users/me
const getProfile = async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
};

// GET /api/users/dashboard
const getDashboard = async (req, res) => {
  try {
    const datasets = await Dataset.find({ uploadedBy: req.user._id }).sort({ createdAt: -1 });

    const totalDownloads = datasets.reduce((sum, d) => sum + d.downloadCount, 0);
    const totalLikes = datasets.reduce((sum, d) => sum + d.likes.length, 0);

    res.json({
      datasets,
      stats: {
        totalDatasets: datasets.length,
        totalDownloads,
        totalLikes,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch dashboard data.' });
  }
};

module.exports = { getProfile, getDashboard };
