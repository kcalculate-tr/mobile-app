// G19-S4 md.2 — `kcal:logFlight` köprüsü: Keşfet / eatkcal loglarını tam 1 log_add olarak
// sayar; Tara uçuşlarını (source='scan') SAYMAZ çünkü Tara log_add'ı scanTrack'ten gider.
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

test('Keşfet logu → tam 1 log_add{source:kesfet}', () => {
  emitLogFlight({ id: 'c1', x: 0, y: 0, w: 0, h: 0, mealLabel: 'Öğle', source: 'kesfet', kcal: 320 });
  expect(sent).toEqual([['log_add', { source: 'kesfet', slot: 'lunch', kcal: 320, offline: false }]]);
});

test('eatkcal logu → tam 1 log_add{source:order}', () => {
  emitLogFlight({ id: 'c2', x: 0, y: 0, w: 0, h: 0, mealLabel: 'Akşam', source: 'eatkcal', kcal: 540 });
  expect(sent).toEqual([['log_add', { source: 'order', slot: 'dinner', kcal: 540, offline: false }]]);
});

test('Tara uçuşu → köprü olay GÖNDERMEZ (scanTrack zaten 1 log_add gönderdi)', () => {
  emitLogFlight({ x: 0, y: 0, w: 0, h: 0, mealLabel: 'Öğle', source: 'scan', kcal: 280 });
  expect(sent).toEqual([]);
});

test('Geri al → tam 1 log_delete, kaynak ilk uçuştan', () => {
  emitLogFlight({ id: 'c3', x: 0, y: 0, w: 0, h: 0, mealLabel: 'Kahvaltı', source: 'kesfet', kcal: 200 });
  sent.length = 0;
  emitLogUndo({ id: 'c3' });
  expect(sent).toEqual([['log_delete', { source: 'kesfet', slot: 'breakfast', undone: false }]]);
});
