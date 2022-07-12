import { task } from '../../task';

export default (on, config) => {
  task.register(on);
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
  return config;
};
