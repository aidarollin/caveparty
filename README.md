# Cave Party

Share the aux.

A shared song queue for a party. One device plays the music from YouTube. Everyone else
opens the same link on their own phone to add songs, reorder the queue, pause, skip, and
see who queued what.

## What it does

- People enter a name and pick an avatar the first time: one of twelve meme doodles, or
  their own photo, which they can move, zoom, rotate and brighten before it is used. The same
  device remembers them next time, and they can change the name, avatar and photo from the
  avatar button.
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
- Four themes, chosen in the profile dialog, and a sun or moon button beside the avatar for
  light and dark mode (two themes have both). Both are remembered on that device. See
  "Themes" below.

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
public/index.html        page shell, sets the saved theme before the first paint
public/styles.css        colour tokens for every theme, and all styling
public/music-color.js    reads the song artwork and does the colour maths (brand kit, unchanged)
public/avatars.js        the preset avatars: twelve meme doodles, drawn for this app
public/photo-editor.js   the adjust and crop editor for a photo avatar
public/favicon.*, icon-*.png, apple-touch-icon.png, site.webmanifest, cave-party-*.svg
                         the disco ball: browser tab, home screen icons and source artwork
public/app.js            the whole app (profile, party, queue, player)
public/config.js         your Firebase config and optional YouTube key
public/vendor/           SortableJS (drag to reorder) and qrcode-generator (invite QR)
database.rules.json      Realtime Database security rules
firebase.json            hosting and rules deploy config
```

## How it looks

Cave Party is frosted glass over a lit ground. The artwork of the song that is playing glows,
blurred, behind the panels, and two soft lights sit in the top corners. One accent colour
marks the next thing to do and the thing that is live.

### Themes

Each person picks a theme for their own device. It is in the profile dialog (the avatar button
at the top, or Edit on the start screen), under the name and avatar. A pick applies at once
and is remembered on that device. Other people keep their own choice.

The light and dark switch is the sun or moon button right beside the avatar (and at the top
of the start screens). It is hidden for the two themes that have only one look.

| Theme | Look | Light mode | Takes colours from the song |
| --- | --- | --- | --- |
| Classic (the default) | Near black with a green accent | Yes | No |
| Midnight mint | The Cave Party brand colours: midnight with mint | Yes | Yes |
| App colours | Cobalt with sun yellow, the colours the app started with | No | Yes |
| Night market | Plum night with pink neon and a lantern light | No | Yes |

Until someone presses that button, the app follows the light or dark setting of the device. Titles
use the same typeface (Figtree) in every theme.

Every colour is a token at the top of `public/styles.css`, one block per theme and mode, all
with the same names. To add a theme, add a block there and one line to `PALETTES` in
`public/app.js`. The Midnight mint values and the icons come from the Cave Party brand kit.

### The room follows the song

In every theme except Classic, the app reads the artwork of the playing song and fades the
background, the glass, the dialogs and the two corner lights to colours taken from it. Only
the hue and strength come from the song. Lightness stays with the theme, and text and the
accent never change. It runs on every device in the party. Artwork that is nearly black and
white keeps the theme's own colours, and so does the moment when nothing plays.

Reading the artwork and the colour maths come from `public/music-color.js` (from the brand
kit, unchanged). Midnight mint uses that script's own recipe. App colours and Night market
keep each colour's own lightness and strength and take the hue from the song.

YouTube's thumbnail host allows other sites to read its pictures, so this works in the
browser with no proxy.

Choices that keep quiet text readable for every song, in every theme:

- Text fields sit on the solid page colour instead of on the glass, so the placeholder has
  the same contrast whatever artwork is behind the panel.
- The icon in the top left corner uses the main text colour, because the lights and the
  artwork are strongest there.
- App colours lets less of the artwork through, because its ground is bright already.

### Avatars

The preset avatars are meme doodles in the hand-drawn sticker style: a thick wobbly outline,
flat colours and a silly face. All twelve are original drawings made for this app and live
in `public/avatars.js` as small SVG pictures. A profile stores its pick as a position in that
list, so add new doodles at the end. Moving or removing one changes the face of everyone who
picked it.

### Photo avatars

Choosing a photo opens an editor in a popup over the profile dialog. Drag the photo to move
it, and zoom with the slider, the mouse wheel or a two finger pinch. Arrow keys nudge it and
plus and minus zoom. The round arrow on the photo turns it a quarter turn, Brightness and
Contrast adjust the tone, and Reset puts everything back. What is inside the circle becomes
the avatar: a 128 pixel square. Use photo keeps it. Cancel, the cross, Escape or a click
outside leave the old avatar as it was. Because the editor is its own popup, a name or device
being typed in the profile dialog is never touched.

Once a photo is the avatar, a pencil icon inside the photo box opens the editor again, with
the framing, zoom and tone where they were left. It edits the original photo, not the small
result, so a crop can be undone or moved.

- Only the 128 pixel result is shared with the party.
- The original is kept on that device only, as a copy of at most 900 pixels on a side (a few
  hundred kilobytes at most), so it can be edited again later. It is never sent anywhere.
  Clearing the browser's site data removes it, and the pencil then edits the small result
  instead.
- A see-through PNG gets a white background.

## How the data is shaped

```
rooms/{CODE}/meta        name (only when renamed), createdAt, createdBy
rooms/{CODE}/player      uid of the device that plays the music
rooms/{CODE}/members     one entry per device: name, avatar, device, online
rooms/{CODE}/q           now (current song), items (the queue), hist (played songs), state, position
search/{hash}            saved search results, shared by every party, kept for a week
```
