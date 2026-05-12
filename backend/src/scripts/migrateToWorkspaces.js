const path = require('path');
const fs = require('fs');

// 手動載入 .env（不依賴 dotenv 模組）
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}

// 確保 require 可以找到 node_modules
const backendRoot = path.join(__dirname, '../..');
process.chdir(backendRoot);

const mongoose = require('mongoose');
const { User, Workspace, Channel, Flow, Segment, Broadcast, Campaign } = require('../models');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const users = await User.find({});
  console.log(`Found ${users.length} users`);

  const userToWorkspace = new Map();

  for (const user of users) {
    let ws = await Workspace.findOne({ owner: user._id });
    if (!ws) {
      ws = await Workspace.create({
        name: `${user.name}的工作區`,
        owner: user._id,
        members: [{ user: user._id, role: 'admin' }],
      });
      console.log(`Created workspace for ${user.email}: ${ws.name}`);
    } else {
      console.log(`Workspace already exists for ${user.email}: ${ws.name}`);
    }
    userToWorkspace.set(user._id.toString(), ws._id);
  }

  const models = [
    { Model: Channel, name: 'Channel' },
    { Model: Flow, name: 'Flow' },
    { Model: Segment, name: 'Segment' },
    { Model: Broadcast, name: 'Broadcast' },
    { Model: Campaign, name: 'Campaign' },
  ];

  for (const { Model, name } of models) {
    const docs = await Model.find({ workspace: { $exists: false } });
    let migrated = 0;
    for (const doc of docs) {
      const wsId = userToWorkspace.get(doc.ownedBy?.toString());
      if (wsId) {
        await Model.updateOne({ _id: doc._id }, { $set: { workspace: wsId } });
        migrated++;
      } else {
        console.warn(`  [WARNING] ${name} ${doc._id} has no matching workspace (ownedBy: ${doc.ownedBy})`);
      }
    }
    console.log(`Migrated ${migrated}/${docs.length} ${name} documents`);
  }

  // 填充 Channel.workspaces 陣列（多工作區共享頻道功能）
  const channelsToFill = await Channel.find({ workspace: { $exists: true }, workspaces: { $size: 0 } });
  let filledCount = 0;
  for (const ch of channelsToFill) {
    if (ch.workspace) {
      await Channel.updateOne({ _id: ch._id }, { $addToSet: { workspaces: ch.workspace } });
      filledCount++;
    }
  }
  console.log(`Populated workspaces[] for ${filledCount} channels`);

  console.log('Migration complete!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
