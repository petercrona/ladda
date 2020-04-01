import { Change, ChangeListener } from './types';

export interface ListenerStore {
  onChange: ChangeListener
  addChangeListener(listener: ChangeListener): () => ChangeListener[]
}

export const createListenerStore = ():ListenerStore => {
  const listeners:ChangeListener[] = [];

  return {
    onChange(change:Change) {
      listeners.forEach((listener) => listener(change));
    },
    addChangeListener(listener: ChangeListener) {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i !== -1) {
          listeners.splice(i, 1);
        }
        return listeners;
      };
    }
  };
};