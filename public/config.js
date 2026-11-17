// Pass the Aux settings.
// 1. Paste your Firebase web app config below (Firebase console > Project settings > Your apps).
//    If you host on Firebase Hosting you can leave it empty: the app then reads the
//    config that Firebase Hosting serves automatically.
// 2. Add a YouTube Data API key to switch on song search (by title, artist or lyrics).
//    This is an API key, not an OAuth client ID. Without it, people can only paste YouTube links.

window.PARTY_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    appId: ""
  },
  youtubeApiKey: ""
};
