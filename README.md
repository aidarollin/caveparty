# Pass the Aux

A shared song queue for a party. One device plays the music from YouTube. Everyone else
opens the same link on their own phone to add songs, reorder the queue, pause, skip, and
see who queued what.

## What it does

- People enter a name and pick an avatar (or use their own photo) the first time. The same
  device remembers them next time, and they can change both from the avatar button.
- One device plays the songs. Everyone sees whose device it is and can move the music to
  any other device in the party.
- Everyone can search for a song by title, artist or lyrics and add it, drag to reorder,
  play a song next, or remove it. Each song in the queue shows who queued it.
- Everyone sees how many people are in the party and who they are.
- The party is named after the owner of the playing device, for example "Zul's party".
  Anyone can rename it. Clearing the name goes back to the automatic one.
- Invite people with a link, a QR code, or a five-letter party code.
- Light and dark mode. The app follows the device setting until someone uses the sun or
  moon button, and then remembers that choice on that device.

## Try it on your computer first (no setup)

```
npx serve public
```

Open http://localhost:3000/?demo in two or three tabs. Demo mode keeps everything in your
browser, and each tab can act as a different person if you give it a different name in the
address, for example `?demo=aida` and `?demo=nadia`.

## Put it online with Firebase (free plan)

1. Go to https://console.firebase.google.com and create a project. Google Analytics is
   not needed.
2. In the console, open **Realtime Database** and click **Create database**. Pick the
   location closest to you (Singapore is `asia-southeast1`). Choose **locked mode**. The
   real rules are deployed in step 6.
3. Open **Authentication**, click **Get started**, then under **Sign-in method** enable
   **Anonymous**. This gives each device a stable identity without anyone creating an
   account.
4. Open **Project settings** (the gear icon), scroll to **Your apps**, add a **Web app**,
   and copy the `firebaseConfig` values into `public/config.js`. Check that `databaseURL`
   is in there. If it is missing, the database was created after the web app: reopen the
   config in Project settings and copy it again.
5. Install the Firebase tools and sign in:

   ```
   npm install -g firebase-tools
   firebase login
   ```

6. From this folder, deploy the site and the database rules:

   ```
   firebase deploy --project YOUR_PROJECT_ID
   ```

7. Add the YouTube API key from the next section so people can search for songs.
8. Open `https://YOUR_PROJECT_ID.web.app`, start a party on the device connected to the
   speakers, and share the invite link.

## Switch on song search (title, artist or lyrics)

People search from inside the app by typing a song title, an artist, or a line of the
lyrics. Search runs on the YouTube Data API, which needs an **API key**. An OAuth client
ID is a different kind of credential and does not work for this.

1. Open https://console.cloud.google.com and pick the Google Cloud project that belongs
   to your Firebase project.
2. Under **APIs and Services**, open **Library** and enable **YouTube Data API v3**.
3. Under **Credentials**, choose **Create credentials**, then **API key**.
4. Restrict the key: under application restrictions choose **Websites** and add
   `https://YOUR_PROJECT_ID.web.app/*`, `https://YOUR_PROJECT_ID.firebaseapp.com/*` and
   `http://localhost:*/*`. Under API restrictions allow only YouTube Data API v3.
5. Paste the key into `youtubeApiKey` in `public/config.js` and deploy again.

Google's default allowance is about 100 searches per day for the whole app. To stretch
it, every search result is saved in the database for a week, so the same search by any
guest costs nothing the second time. When the allowance runs out, the app tells people to
paste a YouTube link instead. For bigger parties, request a higher quota from the
YouTube API quota page in the Google Cloud console.

Until a key is added, people can still add songs by pasting a YouTube link.

## Good to know

- Use a laptop, tablet, or TV browser as the playing device. Phones stop YouTube playback
  when the screen locks or the browser goes to the background.
- Browsers sometimes block sound until someone taps the page. When that happens the
  playing device shows a "Tap to start the music" button. On iPhone and iPad a tap on that
  button may not be enough. The button then steps aside and a line under the video asks
  for a press on the play button inside the video.
- Some videos cannot be played outside youtube.com. The app refuses most of them when
  they are added and skips the rest with a notice to everyone.
- If YouTube fails on the playing device for a reason that is not about the song (a lost
  connection, for example), the app stays on the song and says so on that device instead
  of skipping through the queue.
- Anyone with the party link can add, reorder, remove, pause, skip, rename, and move the
  music. That is the point of the app, so share the link only with your guests.
- Parties stay in the database until you delete them. To clean up, remove old entries
  under `rooms` in the Realtime Database console.

## Files

```
public/index.html        page shell, picks light or dark before the first paint
public/styles.css        design tokens (dark and light) and all styling
public/app.js            the whole app (profile, party, queue, player)
public/config.js         your Firebase config and optional YouTube key
public/vendor/           SortableJS (drag to reorder) and qrcode-generator (invite QR)
database.rules.json      Realtime Database security rules
firebase.json            hosting and rules deploy config
```

## How it looks

Near-black with one green accent in dark mode, soft paper white in light mode. The artwork
of the song that is playing glows, blurred, behind two panes of frosted glass: what is
playing on the left, the queue on the right. Every colour is a token at the top of
`public/styles.css`, once for dark and once for light, so a new palette is a change in
one place.

## How the data is shaped

```
rooms/{CODE}/meta        name (only when renamed), createdAt, createdBy
rooms/{CODE}/player      uid of the device that plays the music
rooms/{CODE}/members     one entry per device: name, avatar, device, online
rooms/{CODE}/q           now (current song), items (the queue), state, position
search/{hash}            saved search results, shared by every party, kept for a week
```
