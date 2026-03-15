import app from '../src/app.js';
import config from '../src/config/config.js';

app.listen(config.app.port, () => {
  console.log(`Server running successfully`);
});

export default app;
