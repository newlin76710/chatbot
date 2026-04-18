const { Workspace } = require('../models');

const ROLE_LEVEL = { viewer: 0, editor: 1, admin: 2 };

module.exports = function workspaceAuth(requiredRole = 'viewer') {
  return async (req, res, next) => {
    try {
      const workspaceId = req.headers['x-workspace-id'];
      if (!workspaceId)
        return res.status(400).json({ error: 'X-Workspace-Id header required' });

      const workspace = await Workspace.findById(workspaceId);
      if (!workspace || !workspace.isActive)
        return res.status(404).json({ error: 'Workspace not found' });

      const member = workspace.members.find(m => m.user.equals(req.user._id));
      if (!member)
        return res.status(403).json({ error: 'Not a member of this workspace' });

      if (ROLE_LEVEL[member.role] < ROLE_LEVEL[requiredRole])
        return res.status(403).json({ error: 'Insufficient permissions' });

      req.workspace  = workspace;
      req.memberRole = member.role;
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
};
