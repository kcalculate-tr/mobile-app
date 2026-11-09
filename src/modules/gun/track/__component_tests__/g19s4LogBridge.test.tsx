// G19-S4 md.2 — `kcal:logFlight` köprüsü: kaynağı kendini raporlamayan logları (eatkcal …)
// tam 1 log_add olarak sayar; Tara (scanTrack) ve Keşfet (KesfetScreen.logMeal) log_add'ını
// kendisi gönderdiği için onların uçuşlarını SAYMAZ.
import { emitLogFlight, emitLogUndo } from '../../../shell/logEvents';
import { wireLogEventsBridge } from '../logEventsBridge';
import { setTrackSink } from '../events';

const sent: [string, Record<string, unknown>][] = [];

beforeAll(() => {
  setTrackSink((n, p) => sent.push([n, p]));
  wireLogEventsBridge();
  wireLogEventsBridge(); // ikinci bağlama yeni dinleyici eklemez
});
afterAll(() => setTrackSink(null));
beforeEach(() => {
  sent.length = 0;
});

test('Keşfet uçuşu → köprü olay GÖNDERMEZ (KesfetScreen zaten 1 log_add gönderdi)', () => {
  emitLogFlight({ id: 'c1', x: 0, y: 0, w: 10, h: 10, mealLabel: 'Öğle', source: 'kesfet', kcal: 320 });
  emitLogUndo({ id: 'c1' });
  expect(sent).toEqual([]);
});

test('eatkcal logu → tam 1 log_add{source:order}', () => {
  emitLogFlight({ id: 'c2', x: 0, y: 0, w: 0, h: 0, mealLabel: 'Akşam', source: 'eatkcal', kcal: 540 });
  expect(sent).toEqual([['log_add', { source: 'order', slot: 'dinner', kcal: 540, offline: false }]]);
});

test('Tara uçuşu → köprü olay GÖNDERMEZ (scanTrack zaten 1 log_add gönderdi)', () => {
  emitLogFlight({ x: 0, y: 0, w: 0, h: 0, mealLabel: 'Öğle', source: 'scan', kcal: 280 });
  expect(sent).toEqual([]);
});

test('Geri al → yalnız köprünün saydığı kayıt için tam 1 log_delete', () => {
  emitLogFlight({ id: 'c3', x: 0, y: 0, w: 0, h: 0, mealLabel: 'Kahvaltı', source: 'eatkcal', kcal: 200 });
  sent.length = 0;
  emitLogUndo({ id: 'c3' });
  emitLogUndo({ id: 'c3' }); // ikinci geri al yok sayılır
  emitLogUndo({ id: 'bilinmeyen' });
  expect(sent).toEqual([['log_delete', { source: 'order', slot: 'breakfast', undone: false }]]);
});
