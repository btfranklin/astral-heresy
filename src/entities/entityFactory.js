let nextId = 1;

export function createEntity(type, components) {
  return {
    id: nextId++,
    type,
    components,
    dead: false,
  };
}

export function addEntity(state, entity) {
  state.entities.push(entity);
  return entity;
}

export function removeEntity(entity) {
  entity.dead = true;
}

export function flushEntities(state) {
  state.entities = state.entities.filter((entity) => !entity.dead);
}

export function findEntities(state, predicate) {
  return state.entities.filter(predicate);
}
