require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { User, Workspace, Channel, Flow, Segment, Broadcast, Campaign } = require('../models');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
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

  console.log('Migration complete!');
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
