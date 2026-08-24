export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  NewTeam: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Board: undefined;
  Polls: undefined;
  Ranking: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  EventDetail: { eventId: number };
  Account: undefined;
};
