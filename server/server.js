require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const playersRoutes = require('./routes/players');
const sessionsRoutes = require('./routes/sessions');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/sessions', sessionsRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BSBS API listening on port ${PORT}`);
});
