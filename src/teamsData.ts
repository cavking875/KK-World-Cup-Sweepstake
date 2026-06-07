import { Team } from './types';

// Official 2026 FIFA World Cup teams (48 teams, 12 groups of 4)
// Groups confirmed from the December 5, 2025 draw at the Kennedy Center, Washington D.C.
export const WORLD_CUP_TEAMS: Team[] = [
  // Group A - Mexico (host), South Africa, South Korea, Czech Republic
  { id: 'mex', name: 'Mexico', code: 'MEX', group: 'A', rating: 76, flag: '🇲🇽' },
  { id: 'rsa', name: 'South Africa', code: 'RSA', group: 'A', rating: 72, flag: '🇿🇦' },
  { id: 'kor', name: 'South Korea', code: 'KOR', group: 'A', rating: 78, flag: '🇰🇷' },
  { id: 'cze', name: 'Czech Republic', code: 'CZE', group: 'A', rating: 78, flag: '🇨🇿' },

  // Group B - Canada (host), Bosnia and Herzegovina, Qatar, Switzerland
  { id: 'can', name: 'Canada', code: 'CAN', group: 'B', rating: 78, flag: '🇨🇦' },
  { id: 'bih', name: 'Bosnia & Herzegovina', code: 'BIH', group: 'B', rating: 77, flag: '🇧🇦' },
  { id: 'qat', name: 'Qatar', code: 'QAT', group: 'B', rating: 69, flag: '🇶🇦' },
  { id: 'sui', name: 'Switzerland', code: 'SUI', group: 'B', rating: 81, flag: '🇨🇭' },

  // Group C - Brazil, Morocco, Haiti, Scotland
  { id: 'bra', name: 'Brazil', code: 'BRA', group: 'C', rating: 90, flag: '🇧🇷' },
  { id: 'mar', name: 'Morocco', code: 'MAR', group: 'C', rating: 83, flag: '🇲🇦' },
  { id: 'hai', name: 'Haiti', code: 'HAI', group: 'C', rating: 67, flag: '🇭🇹' },
  { id: 'sco', name: 'Scotland', code: 'SCO', group: 'C', rating: 74, flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },

  // Group D - United States (host), Paraguay, Australia, Turkey
  { id: 'usa', name: 'United States', code: 'USA', group: 'D', rating: 79, flag: '🇺🇸' },
  { id: 'par', name: 'Paraguay', code: 'PAR', group: 'D', rating: 73, flag: '🇵🇾' },
  { id: 'aus', name: 'Australia', code: 'AUS', group: 'D', rating: 74, flag: '🇦🇺' },
  { id: 'tur', name: 'Turkey', code: 'TUR', group: 'D', rating: 79, flag: '🇹🇷' },

  // Group E - Germany, Curaçao, Ivory Coast, Ecuador
  { id: 'ger', name: 'Germany', code: 'GER', group: 'E', rating: 88, flag: '🇩🇪' },
  { id: 'cur', name: 'Curacao', code: 'CUR', group: 'E', rating: 66, flag: '🇨🇼' },
  { id: 'civ', name: 'Ivory Coast', code: 'CIV', group: 'E', rating: 78, flag: '🇨🇮' },
  { id: 'ecu', name: 'Ecuador', code: 'ECU', group: 'E', rating: 76, flag: '🇪🇨' },

  // Group F - Netherlands, Japan, Sweden, Tunisia
  { id: 'ned', name: 'Netherlands', code: 'NED', group: 'F', rating: 87, flag: '🇳🇱' },
  { id: 'jpn', name: 'Japan', code: 'JPN', group: 'F', rating: 81, flag: '🇯🇵' },
  { id: 'swe', name: 'Sweden', code: 'SWE', group: 'F', rating: 77, flag: '🇸🇪' },
  { id: 'tun', name: 'Tunisia', code: 'TUN', group: 'F', rating: 71, flag: '🇹🇳' },

  // Group G - Belgium, Egypt, Iran, New Zealand
  { id: 'bel', name: 'Belgium', code: 'BEL', group: 'G', rating: 83, flag: '🇧🇪' },
  { id: 'egy', name: 'Egypt', code: 'EGY', group: 'G', rating: 75, flag: '🇪🇬' },
  { id: 'irn', name: 'Iran', code: 'IRN', group: 'G', rating: 73, flag: '🇮🇷' },
  { id: 'nzl', name: 'New Zealand', code: 'NZL', group: 'G', rating: 65, flag: '🇳🇿' },

  // Group H - Spain, Cape Verde, Saudi Arabia, Uruguay
  { id: 'esp', name: 'Spain', code: 'ESP', group: 'H', rating: 88, flag: '🇪🇸' },
  { id: 'cpv', name: 'Cape Verde', code: 'CPV', group: 'H', rating: 68, flag: '🇨🇻' },
  { id: 'ksa', name: 'Saudi Arabia', code: 'KSA', group: 'H', rating: 68, flag: '🇸🇦' },
  { id: 'uru', name: 'Uruguay', code: 'URU', group: 'H', rating: 80, flag: '🇺🇾' },

  // Group I - France, Senegal, Iraq, Norway
  { id: 'fra', name: 'France', code: 'FRA', group: 'I', rating: 91, flag: '🇫🇷' },
  { id: 'sen', name: 'Senegal', code: 'SEN', group: 'I', rating: 78, flag: '🇸🇳' },
  { id: 'irq', name: 'Iraq', code: 'IRQ', group: 'I', rating: 70, flag: '🇮🇶' },
  { id: 'nor', name: 'Norway', code: 'NOR', group: 'I', rating: 82, flag: '🇳🇴' },

  // Group J - Argentina, Algeria, Austria, Jordan
  { id: 'arg', name: 'Argentina', code: 'ARG', group: 'J', rating: 93, flag: '🇦🇷' },
  { id: 'alg', name: 'Algeria', code: 'ALG', group: 'J', rating: 74, flag: '🇩🇿' },
  { id: 'aut', name: 'Austria', code: 'AUT', group: 'J', rating: 80, flag: '🇦🇹' },
  { id: 'jor', name: 'Jordan', code: 'JOR', group: 'J', rating: 69, flag: '🇯🇴' },

  // Group K - Portugal, DR Congo, Uzbekistan, Colombia
  { id: 'por', name: 'Portugal', code: 'POR', group: 'K', rating: 87, flag: '🇵🇹' },
  { id: 'cod', name: 'DR Congo', code: 'COD', group: 'K', rating: 71, flag: '🇨🇩' },
  { id: 'uzb', name: 'Uzbekistan', code: 'UZB', group: 'K', rating: 67, flag: '🇺🇿' },
  { id: 'col', name: 'Colombia', code: 'COL', group: 'K', rating: 82, flag: '🇨🇴' },

  // Group L - England, Croatia, Ghana, Panama
  { id: 'eng', name: 'England', code: 'ENG', group: 'L', rating: 87, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'cro', name: 'Croatia', code: 'CRO', group: 'L', rating: 81, flag: '🇭🇷' },
  { id: 'gha', name: 'Ghana', code: 'GHA', group: 'L', rating: 72, flag: '🇬🇭' },
  { id: 'pan', name: 'Panama', code: 'PAN', group: 'L', rating: 71, flag: '🇵🇦' },
];

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
