// Rôles attribués côté serveur, jamais depuis un champ fourni par le navigateur.
export const MANAGER_ID = '@gestionnaire.demo:messagerie226.local';
export const AGENTS = Object.freeze([
  { username: 'agent.a', displayname: 'Agent fictif A' },
  { username: 'agent.b', displayname: 'Agent fictif B' },
  { username: 'agent.test', displayname: 'Agent fictif de test révocation' },
  { username: 'gestionnaire.demo', displayname: 'Gestionnaire fictif' },
]);
export const fullId = (username) => `@${username}:messagerie226.local`;
export const roleFor = (id) => id === MANAGER_ID ? 'gestionnaire' : 'agent';
export const revocable = (username) => AGENTS.some((agent) => agent.username === username)
  && fullId(username) !== MANAGER_ID;
