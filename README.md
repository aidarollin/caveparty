# Cave Party

Share the aux.

A shared song queue for a party. One device plays the music from YouTube. Everyone else
opens the same link on their own phone to add songs, reorder the queue, pause, skip, and
see who queued what.

## What it does

- People enter a name and pick an avatar (or use their own photo) the first time. The same
  device remembers them next time, and they can change both from the avatar button.
- One device plays the songs. Everyone sees whose device it is and can move the music to
  any other device in the party.
- Everyone can search for a song by title, artist or lyrics and add it, drag to reorder,
  play a song next, shuffle the queue, or remove a song. Each song in the queue shows who
  queued it. The queue sits above the search box and scrolls inside its own frame when it
  gets long.
- The search box predicts what you are typing. A search shows up to 50 videos at once, and
  "Show more results" loads the next 50.
- Under the search box, "Suggested next" lists songs that go with what is playing.
  Randomize deals a new random set.
- A History sidebar on the left lists the last 50 songs the party played or skipped, newest
  first, and any of them can be added again. The button beside the party name hides and
  shows it. On a wide screen it is a column of its own and the app remembers whether you
  hid it. On a phone it slides in over the page.
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

What uses the allowance and what does not:

- Pressing Search or picking a prediction: one search, unless the same search is already
  saved.
- "Show more results": one more search each time.
- Adding a song from "Suggested next": one search to find it on YouTube, unless saved.
- Typing: nothing. The predictions come from Google's public suggestion feed for YouTube,
  which is free and separate from the YouTube Data API.
- Showing "Suggested next": nothing. The picks come from Deezer's public catalogue, which
  is free and needs no key.

So the text people type goes to Google, and the title of the song that is playing goes to
Deezer. If either service is down, that part of the page simply stays empty.

If the key only allows your live site, search does not work when you run the site on
`localhost`. Add `http://localhost:*/*` to the key's allowed websites if you want that.

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
public/index.html        page shell, picks Cave or Daylight before the first paint
public/styles.css        brand tokens (Cave and Daylight) and all styling
public/music-color.js    makes the room take its colours from the song artwork
public/favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest, cave-party-*.svg
                         the disco ball: browser tab, home screen icons and source artwork
public/app.js            the whole app (profile, party, queue, player)
public/config.js         your Firebase config and optional YouTube key
public/vendor/           SortableJS (drag to reorder) and qrcode-generator (invite QR)
database.rules.json      Realtime Database security rules
firebase.json            hosting and rules deploy config
```

## How it looks

Cave Party is frosted glass over a lit ground. Cave is the dark theme and the default: deep
midnight with a mint light in the top left corner and a periwinkle light in the top right.
Daylight is the light theme. The artwork of the song that is playing glows, blurred, behind
the panels. Mint is the one accent: it marks the next thing to do and the thing that is live.

The colours, the display face (Bricolage Grotesque for the name and titles, Figtree for
everything else) and the icons come from the Cave Party brand kit. Every colour is a token
at the top of `public/styles.css`, once for Cave and once for Daylight, with the same names
as the kit's `tokens.css`.

### The room follows the song

`public/music-color.js` (from the brand kit, unchanged) reads the artwork of the playing
song and fades the background, the glass, the dialogs and the two corner lights to colours
taken from it. Only the hue and strength come from the song. Lightness stays with the brand,
and text and mint never change. It runs on every device in the party. Artwork that is nearly
black and white keeps the brand colours, and so does the moment when nothing plays.

YouTube's thumbnail host allows other sites to read its pictures, so this works in the
browser with no proxy.

Two choices keep quiet text readable for every song:

- Text fields sit on the solid page colour instead of on the glass, so the placeholder has
  the same contrast whatever artwork is behind the panel.
- The two icons in the top corners use the main text colour, because the lights and the
  artwork are strongest there.

## How the data is shaped

```
rooms/{CODE}/meta        name (only when renamed), createdAt, createdBy
rooms/{CODE}/player      uid of the device that plays the music
rooms/{CODE}/members     one entry per device: name, avatar, device, online
rooms/{CODE}/q           now (current song), items (the queue), hist (played songs), state, position
search/{hash}            saved search results, shared by every party, kept for a week
```
