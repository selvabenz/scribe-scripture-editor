import { useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import ProjectsLayout from '@/layouts/projects/Layout';
// import Gitea from '@/components/Sync/Gitea/Gitea';
import AuthenticationContextProvider from '@/components/Login/AuthenticationContextProvider';
import ProjectContextProvider from '@/components/context/ProjectContext';
import ReferenceContextProvider from '@/components/context/ReferenceContext';
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline';
import ProjectFileBrowser from '@/components/Sync/Ag/ProjectFileBrowser';
import Gitea from '@/components/Sync/Gitea/Gitea';
import { SyncContext } from '@/components/Sync/SyncContextProvider';
import { SnackBar } from '@/components/SnackBar';
import { uploadToGitea } from '@/components/Sync/Ag/SyncToGitea';
import { downloadFromGitea } from '@/components/Sync/Gitea/SyncFromGitea';
import useAddNotification from '@/components/hooks/useAddNotification';
import ConfirmationModal from '@/layouts/editor/ConfirmationModal';
import { cloneAndSetProject, updateSettingsFiles } from '@/components/Sync/Gitea/SyncFromGiteaUtils';
import { checkoutJsonFiles, pullProject } from '@/components/Sync/Isomorphic/utils';
import Door43Logo from '@/icons/door43.svg';
import * as logger from '../../logger';
import packageInfo from '../../../../package.json';

export default function Sync() {
  const { t } = useTranslation();
  const [auth, setAuth] = useState(undefined);
  const [repo, setRepo] = useState(undefined);
  const [pullPopUp, setPullPopup] = useState({ status: false });
  const [pullData, setPullData] = useState();

  const [snackBar, setOpenSnackBar] = useState(false);
  const [snackText, setSnackText] = useState('');
  const [notify, setNotify] = useState();

  const {
    states: {
      selectedAgProject, syncProgress, selectedGiteaProjectBranch,
    },
    action: {
      setSyncProgress, setSelectedGiteaProject,
    },
  } = useContext(SyncContext);

  const { addNotification } = useAddNotification();

  function notifyStatus(status, message) {
    setNotify(status);
    setSnackText(message);
    setOpenSnackBar(true);
  }

  const handleCloudSync = async (projectData, authData, setSyncProgress) => {
    if (!auth) {
      notifyStatus('failure', 'Authentication Failed! , login and try again');
    } else if (!projectData?.projectName) {
      notifyStatus('warning', 'select a project to sync');
    } else {
      await uploadToGitea(projectData, authData, setSyncProgress, notifyStatus, addNotification, setPullPopup);
    }
  };

  const handleOfflineSync = async (currentRepo, currentAuth) => {
    if (currentAuth && currentRepo && selectedGiteaProjectBranch?.name) {
      logger.debug('Sync.js', 'in offlineSync Started');
      await downloadFromGitea(currentRepo, currentAuth, setSyncProgress, notifyStatus, setSelectedGiteaProject, addNotification, selectedGiteaProjectBranch.name, setPullPopup, setPullData);
      logger.debug('Sync.js', 'in offlineSync Finished');
    } else if (!selectedGiteaProjectBranch?.name) {
      logger.debug('Sync.js', 'Do select a branch');
      notifyStatus('warning', 'Do select a branch');
    } else {
      logger.debug('Sync.js', 'in offlineSync Sync Failed , Something Wrong, may be internet issue');
      notifyStatus('failure', 'Something went wrong! , login and try again');
    }
  };

  const continuePullAction = async () => {
    if (pullData) {
      if (pullPopUp?.type === 'overwrite') {
        // for pull without conflict
        const checkoutFIles = await checkoutJsonFiles(pullData.fs, pullData.gitprojectDir, pullData.checkoutBranch);
        const pullStatus = checkoutFIles && await pullProject(pullData.fs, pullData.gitprojectDir, pullData.userBranch, auth.token.sha1, pullData.checkoutBranch);
        pullStatus?.status && await updateSettingsFiles(
          pullData.fs,
          pullData.sbDataObject,
          pullData.projectDir,
          pullData.projectName,
          pullData.id,
          pullData.currentUser,
          pullData.updateBurrito,
          pullData.action,
        );
        logger.debug('Sync.js', 'Project Sync to scribe successfull, overwirte with server changes');
        await notifyStatus('success', 'Project Sync to scribe successfull');
        await addNotification('Sync', 'Project Sync Successfull', 'success');
      } else {
        // delete project + clone the project
        await pullData?.fs.rmdir((pullData?.gitprojectDir), { recursive: true }, async (err) => {
          if (err) {
            logger.debug('Sync.js', 'Error removing project directory for clone');
            // throw new Error(`Remove Resource failed :  ${err}`);
          } else {
            // call clone
            const cloneStatus = await cloneAndSetProject(
              pullData.fs,
              pullData.gitprojectDir,
              pullData.repo,
              pullData.userBranch,
              pullData.auth,
              pullData.checkoutBranch,
            );
            // continue settings file writing
            cloneStatus && await updateSettingsFiles(
              pullData.fs,
              pullData.sbDataObject,
              pullData.projectDir,
              pullData.projectName,
              pullData.id,
              pullData.currentUser,
              pullData.updateBurrito,
              pullData.action,
            );
          }
        logger.debug('Sync.js', 'Project Sync to scribe successfull, clone successfull');
        await notifyStatus('success', 'Project Sync to scribe successfull');
        await addNotification('Sync', 'Project Sync Successfull', 'success');
      });
      }
    } else {
        logger.debug('Sync.js', 'error pullData not set from function');
    }
  };

  return (
    <AuthenticationContextProvider>
      <ProjectContextProvider>
        <ReferenceContextProvider>
          <ProjectsLayout>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 h-full">
              {/* local projecr side */}
              <div className="bg-white border-x border-gray-200 h-full">
                <div className="flex justify-between items-center p-3 px-5 uppercase tracking-wider shadow-sm border-b border-gray-200">
                  {/* <span className="font-semibold">Local Projects</span> */}
                  <span className="font-semibold">Sync</span>
                  <button
                    type="button"
                    className="text-white bg-primary hover:bg-primary focus:ring-4 focus:outline-none focus:ring-primary font-medium text-xs px-3 py-1.5 text-center inline-flex items-center rounded-full gap-2 uppercase tracking-wider"
                    onClick={() => handleCloudSync(selectedAgProject, auth, setSyncProgress)}
                    disabled={syncProgress.syncStarted}
                  >
                    <CloudArrowUpIcon className="h-5 w-5" />
                    Cloud Sync
                  </button>
                </div>

                <div className="flex justify-between items-center h-14 px-5 tracking-wide shadow-sm border-b border-gray-200">
                  <div className="font-bold ">
                    {packageInfo.name}
                    {' '}
                    Project
                  </div>
                  <div className="text-xs font-semibold uppercase">
                    Last Sync
                  </div>
                </div>

                <div>
                  <ProjectFileBrowser />
                </div>
              </div>

              {/* cloud project side */}
              <div className="bg-white border-x border-gray-200">
                <div className="flex justify-between items-center px-5 uppercase tracking-wider shadow-sm border-b border-gray-200">
                  <span className="font-semibold">Cloud PROJECTS</span>

                  <ul class="flex flex-wrap text-xs font-medium text-center text-gray-500">
                    <li class="mr-2">
                      <a
                        href="#door43"
                        aria-current="page"
                        class="inline-block p-3 px-5 mt-4 text-white bg-black rounded-t-lg active border-primary border-b-4"
                      >
                        <Door43Logo className="inline mr-2 w-4" fill="#9bc300" />
                        {t('label-door43')}
                      </a>
                    </li>
                    {/* will use other syncs in future */}
                    {/* <li class="mr-2">
                      <a
                        href="#paratext"
                        class="inline-block p-3 px-5 mt-4 bg-gray-200 rounded-t-lg hover:text-white hover:bg-black"
                      >
                        ParaText
                      </a>
                    </li>
                    <li class="mr-2">
                      <a
                        href="#gitea"
                        class="inline-block p-3 px-5 mt-4 bg-gray-200 rounded-t-lg hover:text-white hover:bg-black"
                      >
                        Gitea
                      </a>
                    </li> */}
                  </ul>

                  {auth && repo && (
                  <button
                    type="button"
                    className="text-white bg-primary hover:bg-primary focus:ring-4 focus:outline-none focus:ring-primary font-medium text-xs px-3 py-1.5 text-center inline-flex items-center rounded-full gap-2 uppercase tracking-wider"
                    onClick={() => handleOfflineSync(repo, auth)}
                    disabled={syncProgress.syncStarted}
                  >
                    <CloudArrowDownIcon className="h-5 w-5" />
                    Offline Sync
                  </button>
                  )}

                </div>
                <Gitea setAuth={setAuth} setRepo={setRepo} />
              </div>
            </div>

            <SnackBar
              openSnackBar={snackBar}
              snackText={snackText}
              setOpenSnackBar={setOpenSnackBar}
              setSnackText={setSnackText}
              error={notify}
            />
            <ConfirmationModal
              openModal={pullPopUp?.status}
              title={pullPopUp?.title}
              setOpenModal={() => setPullPopup((prev) => ({ ...prev, status: false }))}
              confirmMessage={pullPopUp?.confirmMessage}
              buttonName={pullPopUp?.buttonName}
              closeModal={continuePullAction}
            />
          </ProjectsLayout>
        </ReferenceContextProvider>
      </ProjectContextProvider>
    </AuthenticationContextProvider>
  );
}
