/* eslint-disable no-unused-expressions */

import sinon from 'sinon';
import {build} from './builder';
import {curry} from './fp';

const getUsers = () => Promise.resolve([{id: 1}, {id: 2}]);
getUsers.operation = 'READ';

const deleteUser = () => Promise.resolve();
deleteUser.operation = 'DELETE';

const config = () => ({
  user: {
    ttl: 300,
    api: {
      getUsers,
      deleteUser
    },
    invalidates: ['alles']
  }
});

describe('builder', () => {
  it('Builds the API', () => {
    const api = build(config());
    expect(api).to.be.ok;
  });
  it('Two read api calls will only require one api request to be made', (done) => {
    const myConfig = config();
    myConfig.user.api.getUsers = sinon.spy(myConfig.user.api.getUsers);
    const api = build(myConfig);

    const expectOnlyOneApiCall = () => {
      expect(myConfig.user.api.getUsers.callCount).to.equal(1);
      done();
    };

    Promise.resolve()
      .then(() => api.user.getUsers())
      .then(() => api.user.getUsers())
      .then(expectOnlyOneApiCall);
  });
  it('Two read api calls will return the same output', (done) => {
    const myConfig = config();
    myConfig.user.api.getUsers = sinon.spy(myConfig.user.api.getUsers);
    const api = build(myConfig);

    const expectOnlyOneApiCall = (xs) => {
      expect(xs).to.be.deep.equal([{id: 1}, {id: 2}]);
      done();
    };

    Promise.resolve()
      .then(() => api.user.getUsers())
      .then(() => api.user.getUsers())
      .then(expectOnlyOneApiCall);
  });
  it('1000 calls is not slow', (done) => {
    const myConfig = config();
    myConfig.user.api.getUsers = sinon.spy(myConfig.user.api.getUsers);
    myConfig.user.api.getUsers.idFrom = 'ARGS';
    const api = build(myConfig);
    const start = Date.now();
    const checkTimeConstraint = (xs) => {
      expect(Date.now() - start < 1000).to.be.true;
      done();
    };

    let bc = Promise.resolve();
    for (let i = 0; i < 1000; i++) {
      bc = bc.then(() => api.user.getUsers('wei'));
    }
    bc.then(checkTimeConstraint);
  });
  it('Works with non default id set', (done) => {
    const myConfig = config();
    myConfig.__config = {idField: 'mySecretId'};
    myConfig.user.api.getUsers = sinon.spy(() => Promise.resolve([{mySecretId: 1}, {mySecretId: 2}]));
    myConfig.user.api.getUsers.operation = 'READ';
    const api = build(myConfig);
    const expectOnlyOneApiCall = (xs) => {
      expect(myConfig.user.api.getUsers.callCount).to.equal(1);
      expect(xs).to.be.deep.equal([{mySecretId: 1}, {mySecretId: 2}]);
      done();
    };

    Promise.resolve()
      .then(() => api.user.getUsers())
      .then(() => api.user.getUsers())
      .then(expectOnlyOneApiCall);
  });
  it('Delete removes value from cached array', (done) => {
    const myConfig = config();
    myConfig.user.api.getUsers = sinon.spy(() => Promise.resolve([{id: 1}, {id: 2}]));
    myConfig.user.api.getUsers.operation = 'READ';
    const api = build(myConfig);
    const expectUserToBeRemoved = (xs) => {
      expect(xs).to.be.deep.equal([{id: 2}]);
      done();
    };

    Promise.resolve()
      .then(() => api.user.getUsers())
      .then(() => api.user.deleteUser(1))
      .then(() => api.user.getUsers())
      .then(expectUserToBeRemoved);
  });
  it('TTL set to zero means we never get a cache hit', (done) => {
    const myConfig = config();
    myConfig.user.ttl = 0;
    myConfig.user.api.getUsers = sinon.spy(myConfig.user.api.getUsers);
    const api = build(myConfig);

    const expectOnlyOneApiCall = () => {
      expect(myConfig.user.api.getUsers.callCount).to.equal(2);
      done();
    };

    const delay = () => new Promise(res => setTimeout(() => res(), 1));

    Promise.resolve()
      .then(() => api.user.getUsers())
      .then(delay)
      .then(() => api.user.getUsers())
      .then(expectOnlyOneApiCall)
      .catch(e => console.log(e));
  });

  it('takes plugins as second argument', (done) => {
    const myConfig = config();
    const pluginTracker = {};
    const plugin = (pConfig) => {
      const pName = pConfig.name;
      pluginTracker[pName] = {};
      return curry((c, entityConfigs, entity, apiFnName, apiFn) => {
        pluginTracker[pName][apiFnName] = true;
        return apiFn;
      });
    };
    const pluginName = 'X';
    const expectACall = () => expect(pluginTracker[pluginName].getUsers).to.be.true;

    const api = build(myConfig, [plugin({ name: pluginName })]);
    api.user.getUsers()
      .then(expectACall)
      .then(() => done());
  });
});
