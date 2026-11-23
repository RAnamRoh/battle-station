import { App } from './app';
import { Online } from './online/online';
import './style.css';

const app = new App();
const online = new Online(app);
// An invite link opens straight into its room; anything else opens the menu.
if (!online.openFromUrl()) app.menu();
