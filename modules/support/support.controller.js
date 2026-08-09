const SupportAgent = require('./SupportAgent');
const SupportTeam = require('./SupportTeam');
const SupportAssignment = require('./SupportAssignment');
const Conversation = require('../chat/Conversation');
const Message = require('../chat/Message');
const { SupportStatus, OnlineStatus } = require('../../shared/enums');

exports.getAgents = async (req, res) => {
  try {
    const agents = await SupportAgent.find().populate('userId', 'displayName avatar email phone').populate('teamId');
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeams = async (req, res) => {
  try {
    const teams = await SupportTeam.find({ isActive: true });
    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    // Return conversations assigned to this agent, or all if admin
    let filter = {};
    if (req.currentUser.roleCode === 'SUPPORT_AGENT') {
      const agent = await SupportAgent.findOne({ userId: req.currentUser._id });
      if (!agent) {
        return res.status(403).json({ success: false, message: 'Support profile not found' });
      }
      const assignments = await SupportAssignment.find({ agentId: agent._id, status: 'ACTIVE' });
      const conversationIds = assignments.map(a => a.conversationId);
      filter = { _id: { $in: conversationIds } };
    }
    
    const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 }).populate('lastMessageId');
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.query;
    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'Missing conversationId' });
    }
    const messages = await Message.find({ conversationId, isDeleted: false }).sort({ createdAt: 1 }).populate('senderId', 'displayName avatar');
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAssignment = async (req, res) => {
  try {
    const { conversationId, agentId } = req.body;
    
    // Check if conversation exists
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });

    // Check if agent exists
    const agent = await SupportAgent.findById(agentId);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    // Inactivate old assignments for this conversation
    await SupportAssignment.updateMany(
      { conversationId, status: 'ACTIVE' },
      { status: 'TRANSFERRED' }
    );

    const newAssignment = await SupportAssignment.create({
      conversationId,
      agentId,
      assignedBy: req.currentUser._id,
      status: 'ACTIVE'
    });

    res.json({ success: true, data: newAssignment, message: 'Assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePresence = async (req, res) => {
  try {
    const { status, onlineStatus } = req.body;
    const agent = await SupportAgent.findOne({ userId: req.currentUser._id });
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Support agent profile not found' });
    }
    
    if (status && Object.values(SupportStatus).includes(status)) {
      agent.status = status;
    }
    if (onlineStatus && Object.values(OnlineStatus).includes(onlineStatus)) {
      agent.onlineStatus = onlineStatus;
    }
    
    await agent.save();
    res.json({ success: true, data: agent, message: 'Presence updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
