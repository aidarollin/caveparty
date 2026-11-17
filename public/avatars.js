// Cave Party preset avatars: a set of meme doodles.
// Every drawing here is original to this app. The style is the hand-drawn sticker look: a thick, slightly
// wobbly black outline, flat colours, pink cheeks and a silly face. Each one is drawn on a 64 by 64 canvas and
// has to read at 18 pixels, so shapes stay big and details few.
//
// A profile stores its pick as "p:" plus the position in this list, so add new doodles at the end. Moving or
// removing one changes the face of everyone who picked it.
//
// name: read out to screen readers in the avatar picker.  bg: the circle behind the doodle.  art: SVG.

(function () {
  // Shared pen: black outline, round ends. Shapes fill with their own colour; plain lines stay unfilled.
  const pen = (inner) => `<g fill="none" stroke="#161616" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
  const dot = (x, y, r = 1.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#161616"/>`;
  const cheek = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="3" fill="#F08A9B"/>`;
  const FROG = '#B9CB6E';

  window.PARTY_DOODLES = [
    {
      name: 'Chick with a cone hat', bg: '#BEE2FF',
      art: pen(`
        <path d="M16 48c-3-11 4-20 16-20s18 9 15 19c-2 7-8 10-15 10s-14-2-16-9z" fill="#FFF7CF"/>
        <path d="M46 44c3 1 4 4 2 6"/>
        <path d="M22 43c2-3 9-3 11 0-2 3-9 3-11 0z" fill="#F7A531"/>
        <path d="M20 27h24l-2.5 4.5h-19z" fill="#F0553A"/>
        <path d="M26 27l6-18 6 18z" fill="#F0553A"/>
        <path d="M29.3 17h5.4l1.3 4h-8z" fill="#FFFFFF" stroke-width="1.8"/>`) + dot(25, 38) + dot(33, 37.5)
    },
    {
      name: 'Frog with glasses', bg: '#FFD9E0',
      art: pen(`
        <path d="M11 60c-2-17 5-30 21-30s23 13 21 30z" fill="${FROG}"/>
        <path d="M14 23c-3-2-5-1-7 1M50 23c3-2 5-1 7 1"/>
        <circle cx="23" cy="24" r="9" fill="#FFFFFF"/><circle cx="41" cy="24" r="9" fill="#FFFFFF"/>
        <path d="M23 43c4 6 14 6 18 0z" fill="#161616"/>
        <path d="M28.5 43.4v3.2h3.5v-3.2M32 43.4v3.2h3.5v-3.2" fill="#FFFFFF" stroke-width="1.5"/>`) + dot(25, 25, 2.4) + dot(39, 25, 2.4) + cheek(15, 42) + cheek(49, 42)
    },
    {
      name: 'Frog with sparkly eyes', bg: '#D9F2FF',
      art: pen(`
        <path d="M10 60c-2-18 6-31 22-31s24 13 22 31z" fill="${FROG}"/>
        <circle cx="22" cy="25" r="10" fill="#161616"/><circle cx="42" cy="25" r="10" fill="#161616"/>
        <path d="M28 41c1.200 2.400 2.800 2.400 4 0 1.200 2.400 2.800 2.400 4 0" stroke-width="2"/>
        <path d="M26 58c-1-5 2-8 6-6 4-2 7 1 6 6" fill="${FROG}" stroke-width="2.2"/>
        <path d="M32 52v4" stroke-width="1.8"/>`)
        + '<circle cx="19" cy="21" r="3.8" fill="#FFFFFF"/><circle cx="26" cy="29" r="1.9" fill="#FFFFFF"/><circle cx="39" cy="21" r="3.8" fill="#FFFFFF"/><circle cx="46" cy="29" r="1.9" fill="#FFFFFF"/>'
        + cheek(12, 43) + cheek(52, 43)
    },
    {
      name: 'Screaming blob', bg: '#FFE08A',
      art: pen(`
        <path d="M21 25c-5 3-8 9-9 16M21 25c-3 5-5 10-5 17M43 25c5 3 8 9 9 16M43 25c3 5 5 10 5 17" stroke-width="1.8"/>
        <path d="M21 60V26c0-9 5-15 11-15s11 6 11 15v34z" fill="#FFFFFF"/>
        <ellipse cx="32" cy="32" rx="7" ry="10.5" fill="#B4566E"/>
        <path d="M27.5 38c2-3 7-3 9 0-2 3.5-7 3.5-9 0z" fill="#F29BB0" stroke-width="1.6"/>`) + dot(27, 17, 1.4) + dot(37, 17, 1.4)
    },
    {
      name: 'Blob by a fire', bg: '#FFF1E0',
      art: pen(`
        <path d="M30 58c-6-9-3-16 1-20 0 4 2 6 3 3 1-7 5-11 9-14-1 6 2 9 4 12 1-3 2-5 4-6 2 9 6 14 3 25z" fill="#F59A23"/>
        <path d="M37 58c-2-6 1-10 4-13 0 3 2 4 3 2 2 3 4 7 2 11z" fill="#FFD84D" stroke-width="1.8"/>
        <path d="M9 60V35c0-8 5-14 11.500-14S32 27 32 35v25z" fill="#F6E3DC"/>
        <path d="M14 33c2-2.500 5-2.500 7 0M23 33c2-2.500 5-2.500 7 0" stroke-width="2.2"/>
        <path d="M19 44h6" stroke-width="2.2"/>`) + dot(17.5, 36) + dot(26.5, 36)
    },
    {
      name: 'Yelling with flame hair', bg: '#E4CCFF',
      art: pen(`
        <path d="M7 60c-2-14 2-23 6-31 1 6 3 9 5 9 0-10 4-18 9-25 1 7 3 11 6 13 1-6 3-9 6-11 1 10 6 14 8 21 2-2 3-5 3-8 5 9 8 19 6 32z" fill="#FFB629"/>
        <path d="M17 60c-2-16 2-30 15-30s17 14 15 30z" fill="#FFFFFF"/>
        <path d="M22 34l6 2M42 34l-6 2" stroke-width="2.2"/>
        <path d="M25 50c0-5 3-8 7-8s7 3 7 8c0 6-3 10-7 10s-7-4-7-10z" fill="#161616"/>
        <path d="M31 43v3.500M33 56v3.500" stroke="#FFFFFF" stroke-width="2"/>`) + dot(26.5, 38.5, 1.4) + dot(37.5, 38.5, 1.4)
    },
    {
      name: 'Chaos frog', bg: '#FFE27A',
      art: pen(`
        <path d="M12 46c-4-4-6-9-5-15M52 46c4-4 6-9 5-15"/>
        <path d="M4 31l-1.500-3M7 30v-4M10 31l1.500-3M60 31l1.500-3M57 30v-4M54 31l-1.500-3" stroke-width="1.8"/>
        <path d="M11 60c-2-16 5-28 21-28s23 12 21 28z" fill="${FROG}"/>
        <ellipse cx="22" cy="24" rx="9.500" ry="7" fill="#FFFFFF" transform="rotate(-18 22 24)"/>
        <ellipse cx="42" cy="22" rx="5.500" ry="8.500" fill="#FFFFFF" transform="rotate(20 42 22)"/>
        <path d="M21 45c2-5 6-7 11-7s9 2 11 7c-2 7-6 9-11 9s-9-2-11-9z" fill="#7A2E2E"/>
        <path d="M26.500 39.500l1.500 3 1.500-3M34.500 39.500l1.500 3 1.500-3M30.500 53.200l1.500-3 1.500 3" fill="#FFFFFF" stroke-width="1.4"/>`)
        + dot(26, 26, 1.7) + dot(41, 26, 1.7) + cheek(14, 48) + cheek(50, 48)
    },
    {
      name: 'Tomato in flames', bg: '#FBE3D2',
      art: pen(`
        <path d="M5 60c-3-10 0-19 4-25 1 5 2 8 4 8-1-9 2-16 7-22 0 6 2 9 4 10 1-7 4-12 8-15 1 7 4 9 6 13 2-3 3-6 3-9 5 6 7 13 6 19 2-1 3-3 4-5 4 9 6 18 4 26z" fill="#F7941D"/>
        <path d="M13 60c-2-7 1-13 4-17 1 4 3 6 4 5 0-6 3-10 7-13 1 5 4 8 6 11 1-3 3-5 5-6 0 6 6 10 7 20z" fill="#FFC83D" stroke="none"/>
        <path d="M19 46c-3-3-5-8-5-12M45 46c3-3 5-8 5-12"/>
        <path d="M18 49c0-9 6-14 14-14s14 5 14 14-6 12-14 12-14-3-14-12z" fill="#E5483F"/>
        <path d="M26 36l6-4 6 4-6 1.500z" fill="#5FA04E" stroke-width="1.8"/>
        <circle cx="27" cy="46" r="3.400" fill="#FFFFFF" stroke-width="1.800"/><circle cx="37" cy="46" r="3.400" fill="#FFFFFF" stroke-width="1.800"/>
        <path d="M29 54h6" stroke-width="2.200"/>`) + dot(27.6, 46.4, 1.3) + dot(36.4, 46.4, 1.3)
    },
    {
      name: 'Cat with sunglasses', bg: '#CFF3E3',
      art: pen(`
        <path d="M14 31l1-15 11 8c4-1 8-1 12 0l11-8 1 15c2 4 3 8 3 12 0 10-9 16-21 16S11 53 11 43c0-4 1-8 3-12z" fill="#F4A259"/>
        <path d="M14 34h15v5c0 3.500-3 6-7.500 6S14 42.500 14 39zM35 34h15v5c0 3.500-3 6-7.500 6S35 42.500 35 39z" fill="#161616"/>
        <path d="M29 35.500h6"/>
        <path d="M18 38l3.500-2.500M39 38l3.500-2.500" stroke="#FFFFFF" stroke-width="1.6"/>
        <path d="M30 48.500l2 2 2-2M32 50.500v2M27.500 54c2 1.600 3.300 1.600 4.500 0 1.200 1.600 2.500 1.600 4.500 0" stroke-width="2"/>`)
    },
    {
      name: 'Capybara with an orange', bg: '#D6E8B8',
      art: pen(`
        <circle cx="32" cy="13" r="6.500" fill="#F7941D"/>
        <path d="M32 6.500c2-2.500 4.500-2.500 6-1-1.500 2.500-4 2.500-6 1z" fill="#5FA04E" stroke-width="1.6"/>
        <path d="M18 25c-3.500-1-4.500-4.500-2.500-7 2.500 0 4.500 1.500 5.500 4M46 25c3.500-1 4.500-4.500 2.500-7-2.500 0-4.500 1.500-5.500 4" fill="#9A6B45"/>
        <path d="M13 37c0-11 8-18 19-18s19 7 19 18v10c0 9-8 13-19 13s-19-4-19-13z" fill="#B98457"/>
        <path d="M22 47c0-5 4-8.500 10-8.500S42 42 42 47s-4 8.500-10 8.500S22 52 22 47z" fill="#A87449" stroke-width="2"/>
        <path d="M32 48.500v3M28.500 52.500c2.300 1.200 4.700 1.200 7 0" stroke-width="2"/>
        <path d="M18.500 33h5.500M40 33h5.500" stroke-width="2.4"/>`) + dot(29, 46, 1.2) + dot(35, 46, 1.2)
    },
    {
      name: 'Happy crying blob', bg: '#FFF0B8',
      art: pen(`
        <path d="M13 60V33c0-11 8-19 19-19s19 8 19 19v27z" fill="#D9C8FF"/>
        <path d="M21.500 36c-1 6-1 13 0 20M25.500 36c1 5 1 10 0 15M38.500 36c-1 5-1 10 0 15M42.500 36c1 6 1 13 0 20" stroke="#4AA8FF" stroke-width="2.400"/>
        <path d="M20 32c2.300-3.500 6-3.500 8 0M36 32c2.300-3.500 6-3.500 8 0"/>
        <path d="M26 43c3 5 9 5 12 0" stroke-width="2.400"/>`)
    },
    {
      name: 'Staring toast', bg: '#FFD1C2',
      art: pen(`
        <path d="M13 27c-4-2-3-12 5-13 9-3 19-3 28 0 8 1 9 11 5 13v27c0 3-2 5-5 5H18c-3 0-5-2-5-5z" fill="#E0B777"/>
        <path d="M18 29c-2-2-1-8 4-9 7-2 13-2 20 0 5 1 6 7 4 9v24H18z" fill="#FBEBC8" stroke="none"/>
        <circle cx="25.500" cy="37" r="4.600" fill="#FFFFFF" stroke-width="2"/><circle cx="38.500" cy="37" r="4.600" fill="#FFFFFF" stroke-width="2"/>
        <path d="M29 48h6" stroke-width="2.400"/>`) + dot(25.5, 37, 1.2) + dot(38.5, 37, 1.2)
    }
  ];
})();
