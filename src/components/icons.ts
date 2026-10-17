// Tek ikon kapisi — phosphor-react-native'in BARREL import'u yerine alt yol.
//
// 17.10.2026 — NEDEN: paket 1512 ikonu `export *` ile disa veriyor ve
// CommonJS'e cevrildigi icin `import { X } from 'phosphor-react-native'`
// ilk calismada 1512 ikon + 1512 tanim modulunu SENKRON execute ediyordu.
// Derlenmis bundle 7,98 MB'in 3,55 MB'i kullanilmayan ikonlarin SVG path
// verisiydi; uygulamanin gercekten kullandigi ikon sayisi asagidaki kadar.
//
// KURAL: ekranlarda 'phosphor-react-native' DOGRUDAN import EDILMEZ.
// Yeni bir ikon gerekiyorsa buraya bir satir ekle, oradan import et.
// Alt yol lib/commonjs/icons: DERLENMIS JS. Paket per-ikon .d.ts'leri
// lib/typescript/icons altinda tuttugu icin tipler tsconfig.json'daki
// `paths` eslemesiyle baglaniyor. (src/*.tsx uzerinden import denendi:
// TS paketin kendi kaynagini tipliyor ve icon-base.tsx react-native-svg
// tipleriyle hata veriyor — o yol kapali.)

export type { Icon, IconProps } from 'phosphor-react-native';

export { ArrowCounterClockwise } from 'phosphor-react-native/lib/commonjs/icons/ArrowCounterClockwise';
export { ArrowLeft } from 'phosphor-react-native/lib/commonjs/icons/ArrowLeft';
export { ArrowRight } from 'phosphor-react-native/lib/commonjs/icons/ArrowRight';
export { Bell } from 'phosphor-react-native/lib/commonjs/icons/Bell';
export { BellRinging } from 'phosphor-react-native/lib/commonjs/icons/BellRinging';
export { Calendar, CalendarIcon } from 'phosphor-react-native/lib/commonjs/icons/Calendar';
export { CalendarBlank } from 'phosphor-react-native/lib/commonjs/icons/CalendarBlank';
export { CalendarCheck } from 'phosphor-react-native/lib/commonjs/icons/CalendarCheck';
export { CalendarX } from 'phosphor-react-native/lib/commonjs/icons/CalendarX';
export { CameraIcon } from 'phosphor-react-native/lib/commonjs/icons/Camera';
export { CaretDown } from 'phosphor-react-native/lib/commonjs/icons/CaretDown';
export { CaretLeft, CaretLeftIcon } from 'phosphor-react-native/lib/commonjs/icons/CaretLeft';
export { CaretRight } from 'phosphor-react-native/lib/commonjs/icons/CaretRight';
export { ChartBar } from 'phosphor-react-native/lib/commonjs/icons/ChartBar';
export { ChartLine } from 'phosphor-react-native/lib/commonjs/icons/ChartLine';
export { ChartLineUp } from 'phosphor-react-native/lib/commonjs/icons/ChartLineUp';
export { ChatCircleDots } from 'phosphor-react-native/lib/commonjs/icons/ChatCircleDots';
export { ChatText } from 'phosphor-react-native/lib/commonjs/icons/ChatText';
export { Check } from 'phosphor-react-native/lib/commonjs/icons/Check';
export { CheckCircle, CheckCircleIcon } from 'phosphor-react-native/lib/commonjs/icons/CheckCircle';
export { ChefHat, ChefHatIcon } from 'phosphor-react-native/lib/commonjs/icons/ChefHat';
export { Clock } from 'phosphor-react-native/lib/commonjs/icons/Clock';
export { ClockCounterClockwise } from 'phosphor-react-native/lib/commonjs/icons/ClockCounterClockwise';
export { Confetti, ConfettiIcon } from 'phosphor-react-native/lib/commonjs/icons/Confetti';
export { CookingPot } from 'phosphor-react-native/lib/commonjs/icons/CookingPot';
export { Copy } from 'phosphor-react-native/lib/commonjs/icons/Copy';
export { CreditCard } from 'phosphor-react-native/lib/commonjs/icons/CreditCard';
export { Crown } from 'phosphor-react-native/lib/commonjs/icons/Crown';
export { CrownSimple, CrownSimpleIcon } from 'phosphor-react-native/lib/commonjs/icons/CrownSimple';
export { Drop } from 'phosphor-react-native/lib/commonjs/icons/Drop';
export { EnvelopeSimple } from 'phosphor-react-native/lib/commonjs/icons/EnvelopeSimple';
export { Eye } from 'phosphor-react-native/lib/commonjs/icons/Eye';
export { EyeSlash } from 'phosphor-react-native/lib/commonjs/icons/EyeSlash';
export { FilePdf } from 'phosphor-react-native/lib/commonjs/icons/FilePdf';
export { FileText } from 'phosphor-react-native/lib/commonjs/icons/FileText';
export { Fire } from 'phosphor-react-native/lib/commonjs/icons/Fire';
export { Flame } from 'phosphor-react-native/lib/commonjs/icons/Flame';
export { ForkKnife } from 'phosphor-react-native/lib/commonjs/icons/ForkKnife';
export { Gift } from 'phosphor-react-native/lib/commonjs/icons/Gift';
export { Handshake } from 'phosphor-react-native/lib/commonjs/icons/Handshake';
export { Headset } from 'phosphor-react-native/lib/commonjs/icons/Headset';
export { House } from 'phosphor-react-native/lib/commonjs/icons/House';
export { Info } from 'phosphor-react-native/lib/commonjs/icons/Info';
export { Leaf } from 'phosphor-react-native/lib/commonjs/icons/Leaf';
export { Lightning } from 'phosphor-react-native/lib/commonjs/icons/Lightning';
export { Lock } from 'phosphor-react-native/lib/commonjs/icons/Lock';
export { LockSimple } from 'phosphor-react-native/lib/commonjs/icons/LockSimple';
export { MagnifyingGlass } from 'phosphor-react-native/lib/commonjs/icons/MagnifyingGlass';
export { MapPin, MapPinIcon } from 'phosphor-react-native/lib/commonjs/icons/MapPin';
export { Minus } from 'phosphor-react-native/lib/commonjs/icons/Minus';
export { NavigationArrow } from 'phosphor-react-native/lib/commonjs/icons/NavigationArrow';
export { Package } from 'phosphor-react-native/lib/commonjs/icons/Package';
export { PencilSimple } from 'phosphor-react-native/lib/commonjs/icons/PencilSimple';
export { Percent } from 'phosphor-react-native/lib/commonjs/icons/Percent';
export { Phone } from 'phosphor-react-native/lib/commonjs/icons/Phone';
export { PhoneCall } from 'phosphor-react-native/lib/commonjs/icons/PhoneCall';
export { Plus } from 'phosphor-react-native/lib/commonjs/icons/Plus';
export { Question } from 'phosphor-react-native/lib/commonjs/icons/Question';
export { Receipt } from 'phosphor-react-native/lib/commonjs/icons/Receipt';
export { Ruler } from 'phosphor-react-native/lib/commonjs/icons/Ruler';
export { Scales } from 'phosphor-react-native/lib/commonjs/icons/Scales';
export { Scooter } from 'phosphor-react-native/lib/commonjs/icons/Scooter';
export { Shield } from 'phosphor-react-native/lib/commonjs/icons/Shield';
export { ShoppingBag } from 'phosphor-react-native/lib/commonjs/icons/ShoppingBag';
export { ShoppingCart, ShoppingCartIcon } from 'phosphor-react-native/lib/commonjs/icons/ShoppingCart';
export { SignOut } from 'phosphor-react-native/lib/commonjs/icons/SignOut';
export { Snowflake } from 'phosphor-react-native/lib/commonjs/icons/Snowflake';
export { Sparkle } from 'phosphor-react-native/lib/commonjs/icons/Sparkle';
export { SquaresFour } from 'phosphor-react-native/lib/commonjs/icons/SquaresFour';
export { Star } from 'phosphor-react-native/lib/commonjs/icons/Star';
export { Storefront } from 'phosphor-react-native/lib/commonjs/icons/Storefront';
export { Tag } from 'phosphor-react-native/lib/commonjs/icons/Tag';
export { Target } from 'phosphor-react-native/lib/commonjs/icons/Target';
export { Thermometer } from 'phosphor-react-native/lib/commonjs/icons/Thermometer';
export { ThumbsDown } from 'phosphor-react-native/lib/commonjs/icons/ThumbsDown';
export { ThumbsUp } from 'phosphor-react-native/lib/commonjs/icons/ThumbsUp';
export { Ticket } from 'phosphor-react-native/lib/commonjs/icons/Ticket';
export { Timer } from 'phosphor-react-native/lib/commonjs/icons/Timer';
export { Trash } from 'phosphor-react-native/lib/commonjs/icons/Trash';
export { TrendDown } from 'phosphor-react-native/lib/commonjs/icons/TrendDown';
export { TrendUp } from 'phosphor-react-native/lib/commonjs/icons/TrendUp';
export { TrophyIcon } from 'phosphor-react-native/lib/commonjs/icons/Trophy';
export { Truck, TruckIcon } from 'phosphor-react-native/lib/commonjs/icons/Truck';
export { User } from 'phosphor-react-native/lib/commonjs/icons/User';
export { Warning } from 'phosphor-react-native/lib/commonjs/icons/Warning';
export { WarningCircle } from 'phosphor-react-native/lib/commonjs/icons/WarningCircle';
export { X } from 'phosphor-react-native/lib/commonjs/icons/X';
export { XCircle, XCircleIcon } from 'phosphor-react-native/lib/commonjs/icons/XCircle';
