// Phone-frame shot definitions. board = Final design source (scratch copy).
// Values = consistent SAMPLE data for store art (not live data), see M-S1-LOG.
const VOICE_EN = [
  ['Bugün 2 fotoğraf hakkın kaldı', '2 AI scans left today'],
  ['Dinliyorum', 'Listening'],
  ['Ne yedin?', 'What did you eat?'],
  ['Söyle, biz yazalım', 'Say it, we’ll write it down'],
  ['iki yumurtalı menemen ve bir dilim ekmek', 'two-egg omelette and a slice of bread'],
  ['Fotoğraf', 'Photo'],
  ['Barkod', 'Barcode'],
  ['Elle', 'Manual'],
  ['Ses', 'Voice'],
];
// Feed (Keşfet): story badges, names, time, plate table. kcal 180+250+110=540, P/K/Y 42/48/18.
const FEED_SEQ = ['420', '380', '510', '290', '640', '2', '250', '180', '110',
  '120', '180', '6', '34', '3',
  '140', '250', '33', '0', '9',
  '160', '110', '3', '14', '6',
  '420'];
const FEED_TR = [['Dyt. [Ad]', 'Dyt. Ece']];
const NAMES = { '[Ad]': ['Selin', 'Mert', 'Ayşe', 'Can'], '[Name]': ['Selin', 'Mert', 'Ayşe', 'Can'] };
const FEED_EN = [['RD [Name]', 'RD Ece']];
// Coach chat (FinCoachChat, 2340 pt board): one phone screen = header + pill + one exchange + composer.
// Bottom-aligned log: first exchange (760 kcal left) scrolls under the header, then the dinner question + 3 ideas.
const coachJs = (q) => `
  const log = document.querySelector('.log');
  const root = log.parentElement;
  const comp = Array.from(root.children).find((c) => c !== log && c.getBoundingClientRect().top > 2000);
  root.style.height = '852px';
  root.style.overflow = 'hidden';
  const kids = Array.from(log.children);
  [5, 6, 7, 8].forEach((i) => { if (kids[i]) kids[i].style.display = 'none'; });
  const tw = document.createTreeWalker(kids[3], NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) { if (tw.currentNode.nodeValue.trim()) { tw.currentNode.nodeValue = ${JSON.stringify(q)}; break; } }
  comp.style.top = (852 - comp.offsetHeight) + 'px';
  log.style.height = (852 - log.offsetTop - comp.offsetHeight) + 'px';
  log.style.overflow = 'hidden';
`;
module.exports = [
  { id: 'tr-01', board: 'FinPhotoR1.dc.html', photos: { 'Fotoğraf:': 't19/ph-mercimek.jpg' } },
  { id: 'en-01', board: 'FinPhotoEN.dc.html', photos: { 'Photo:': 't19/ph-mercimek.jpg' } },
  { id: 'tr-02', board: 'ScanR2Voice.dc.html' },
  { id: 'en-02', board: 'ScanR2Voice.dc.html', replace: VOICE_EN },
  { id: 'tr-03', board: 'FinCoachChat.dc.html', nSeq: ['28'], js: coachJs('Akşam ne yesem?') },
  { id: 'en-03', board: 'FinCoachChatEN.dc.html', replace: [['kcalAI Koç', 'kcalAI Coach']], nSeq: ['28'], js: coachJs('What should I have for dinner?') },
  { id: 'tr-04', board: 'FinHomeR3.dc.html', replace: [['İlter', 'Elif']] },
  { id: 'en-04', board: 'FinHomeEN.dc.html', replace: [['İlter', 'Elif']] },
  {
    id: 'tr-05', board: 'FinEkProduct.dc.html',
    replace: [['[Ürün]', 'Tavuk Kinoa Bowl'], ['[Açıklama]', 'Izgara tavuk, kinoa, avokado, mevsim yeşillikleri'],
      ['[N kcal]', '240 kcal']],
    nSeq: ['285', 'OLDP', 'DISC', '540', '42', '48', '18', '+40', '+80', '240', '35', '0', '9', '285'],
    hide: ['OLDP TL', '%DISC'],
  },
  {
    id: 'en-05', board: 'FinTrackerEN.dc.html', replace: [['İlter', 'Elif']],
    nSeq: ['1,480', '700', '420', '75', '420', '300', '120', '160', '540'],
  },
  { id: 'tr-06', board: 'FinFeed.dc.html', replace: FEED_TR, seqReplace: NAMES, nSeq: FEED_SEQ },
  { id: 'en-06', board: 'FinFeedEN.dc.html', replace: FEED_EN, seqReplace: NAMES, nSeq: FEED_SEQ },
  { id: 'tr-07', board: 'FinSubPaywallCoach.dc.html', wait: 1000 },
  { id: 'en-07', board: 'FinSubPaywallCoachEN.dc.html', wait: 1000 },
];
