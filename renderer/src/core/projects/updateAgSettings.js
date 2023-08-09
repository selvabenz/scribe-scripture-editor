import localforage from 'localforage';
import { splitStringByLastOccurance } from '@/util/splitStringByLastMarker';
import * as logger from '../../logger';
import { environment } from '../../../environment';
import packageInfo from '../../../../package.json';

export const updateAgSettings = async (username, projectName, data) => {
  logger.debug('updateAgSettings.js', 'In updateAgSettings');
  const newpath = localStorage.getItem('userPath');
  const fs = window.require('fs');
  const path = require('path');
  const result = Object.keys(data.ingredients).filter((key) => key.includes(environment.PROJECT_SETTING_FILE));
  const folder = path.join(newpath, packageInfo.name, 'users', username, 'projects', projectName, result[0]);
  const settings = await fs.readFileSync(folder, 'utf8');
  const setting = JSON.parse(settings);
  if (settings.version !== environment.AG_SETTING_VERSION) {
    setting.version = environment.AG_SETTING_VERSION;
    if (!setting.sync && !setting.sync?.services) {
      setting.sync = { services: { door43: [] } };
    } else {
    setting.sync.services.door43 = setting?.sync?.services?.door43 ? setting?.sync?.services?.door43 : [];
  }
}
  setting.project[data.type.flavorType.flavor.name] = data.project[data.type.flavorType.flavor.name];
  logger.debug('updateAgSettings.js', `Updating the ${environment.PROJECT_SETTING_FILE}`);
  await fs.writeFileSync(folder, JSON.stringify(setting));
};
export const saveReferenceResource = () => {
  logger.debug('updateAgSettings.js', 'In saveReferenceResource for saving the reference data');
  localforage.getItem('currentProject').then(async (projectName) => {
    const _projectname = await splitStringByLastOccurance(projectName, '_');
    // const _projectname = projectName?.split('_');
    localforage.getItem('projectmeta').then((value) => {
      Object.entries(value).forEach(
        ([, _value]) => {
          Object.entries(_value).forEach(
            ([, resources]) => {
              const id = Object.keys(resources.identification.primary[packageInfo.name]);
              if (id[0] === _projectname[1]) {
                localforage.getItem('userProfile').then(async (value) => {
                  await updateAgSettings(value?.username, projectName, resources);
                });
              }
            },
          );
        },
      );
    });
  });
};
