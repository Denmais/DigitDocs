/* Constants and Utils */
import './constants/root.js';
import './constants/api.js';
import './utils/stepManager.js';
import './utils/storageObserver.js';
import './utils/cropManager.js';
import './utils/collectFields.js';
/* Services */
import './services/extractService.js';
import './services/viewerState.js';
import './services/collectMock.js';
/* Components  */
import './components/Statusbar/Statusbar.js';
import './components/Sidebar/Sidebar.js';
import './components/Actionbar/Actionbar.js';
import './components/PopUp/PopUp.js';
import { HistoryPage } from './components/HistoryPage/HistoryPage.js';

window.showHistory = () => {
  const page = new HistoryPage({ rootId: 'action-bar' });
  page.render();
};