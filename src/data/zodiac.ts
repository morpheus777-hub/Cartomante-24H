export interface ZodiacInfo {
  name: string;
  element: 'Fogo' | 'Terra' | 'Ar' | 'Água';
  modality: 'Cardinal' | 'Fixo' | 'Mutável';
  ruler: string;
  symbol: string;
  dates: string;
  dailyEnergy: string;
}

export const ZODIAC_SIGNS: ZodiacInfo[] = [
  {
    name: 'Áries',
    element: 'Fogo',
    modality: 'Cardinal',
    ruler: 'Marte',
    symbol: '♈',
    dates: '21 mar – 19 abr',
    dailyEnergy: 'Iniciativa luminosa para abrir caminhos afetivos e profissionais.',
  },
  {
    name: 'Touro',
    element: 'Terra',
    modality: 'Fixo',
    ruler: 'Vênus',
    symbol: '♉',
    dates: '20 abr – 20 mai',
    dailyEnergy: 'Estabilidade sensorial, prosperidade e escolhas maduras no amor.',
  },
  {
    name: 'Gêmeos',
    element: 'Ar',
    modality: 'Mutável',
    ruler: 'Mercúrio',
    symbol: '♊',
    dates: '21 mai – 20 jun',
    dailyEnergy: 'Comunicação clara, mensagens inesperadas e conexões intelectuais.',
  },
  {
    name: 'Câncer',
    element: 'Água',
    modality: 'Cardinal',
    ruler: 'Lua',
    symbol: '♋',
    dates: '21 jun – 22 jul',
    dailyEnergy: 'Intuição acolhedora, cura emocional e proteção do lar.',
  },
  {
    name: 'Leão',
    element: 'Fogo',
    modality: 'Fixo',
    ruler: 'Sol',
    symbol: '♌',
    dates: '23 jul – 22 ago',
    dailyEnergy: 'Brilho pessoal elevado, magnetismo e expressão criativa.',
  },
  {
    name: 'Virgem',
    element: 'Terra',
    modality: 'Mutável',
    ruler: 'Mercúrio',
    symbol: '♍',
    dates: '23 ago – 22 set',
    dailyEnergy: 'Discernimento sutil para organizar metas e hábitos espirituais.',
  },
  {
    name: 'Libra',
    element: 'Ar',
    modality: 'Cardinal',
    ruler: 'Vênus',
    symbol: '♎',
    dates: '23 set – 22 out',
    dailyEnergy: 'Harmonia nos vínculos, equilíbrio cármico e beleza nos encontros.',
  },
  {
    name: 'Escorpião',
    element: 'Água',
    modality: 'Fixo',
    ruler: 'Plutão',
    symbol: '♏',
    dates: '23 out – 21 nov',
    dailyEnergy: 'Transformação profunda, verdade interior e intensidade magnética.',
  },
  {
    name: 'Sagitário',
    element: 'Fogo',
    modality: 'Mutável',
    ruler: 'Júpiter',
    symbol: '♐',
    dates: '22 nov – 21 dez',
    dailyEnergy: 'Expansão espiritual, otimismo e horizontes abertos.',
  },
  {
    name: 'Capricórnio',
    element: 'Terra',
    modality: 'Cardinal',
    ruler: 'Saturno',
    symbol: '♑',
    dates: '22 dez – 19 jan',
    dailyEnergy: 'Estrutura sólida, foco de longo prazo e colheita merecida.',
  },
  {
    name: 'Aquário',
    element: 'Ar',
    modality: 'Fixo',
    ruler: 'Urano',
    symbol: '♒',
    dates: '20 jan – 18 fev',
    dailyEnergy: 'Sincronicidades raras, liberdade afetiva e visão de futuro.',
  },
  {
    name: 'Peixes',
    element: 'Água',
    modality: 'Mutável',
    ruler: 'Netuno',
    symbol: '♓',
    dates: '19 fev – 20 mar',
    dailyEnergy: 'Sensibilidade elevada, sonhos reveladores e sintonia empática.',
  },
];

export const SPIRITUAL_INTERESTS = [
  'Tarot',
  'Baralho Cigano',
  'Astrologia',
  'Mapa Astral',
  'Cristais',
  'Runas',
  'Numerologia',
  'Meditação Lunar',
  'Amor & Sinastria',
  'Prosperidade',
];

export function calculateAstrologicalCompatibility(
  signA: string,
  interestsA: string[],
  signB: string,
  interestsB: string[]
): { score: number; summary: string } {
  const infoA = ZODIAC_SIGNS.find((s) => s.name === signA) ?? ZODIAC_SIGNS[0];
  const infoB = ZODIAC_SIGNS.find((s) => s.name === signB) ?? ZODIAC_SIGNS[6];

  let baseScore = 66;
  let elementNote = '';

  if (infoA.element === infoB.element) {
    baseScore = 91;
    elementNote = `Mesmo elemento (${infoA.element}): reconhecimento imediato e sintonia natural.`;
  } else if (
    (infoA.element === 'Fogo' && infoB.element === 'Ar') ||
    (infoA.element === 'Ar' && infoB.element === 'Fogo')
  ) {
    baseScore = 88;
    elementNote = 'Fogo e Ar se alimentam mutuamente com entusiasmo, diálogo e paixão.';
  } else if (
    (infoA.element === 'Terra' && infoB.element === 'Água') ||
    (infoA.element === 'Água' && infoB.element === 'Terra')
  ) {
    baseScore = 87;
    elementNote = 'Terra e Água criam raízes férteis, cuidado afetivo e cumplicidade.';
  } else if (
    (infoA.element === 'Fogo' && infoB.element === 'Água') ||
    (infoA.element === 'Água' && infoB.element === 'Fogo')
  ) {
    baseScore = 74;
    elementNote = 'Atração intensa entre emoção e impulso; pede escuta e equilíbrio.';
  } else {
    baseScore = 78;
    elementNote = 'Encontro complementar que amplia perspectivas espirituais e práticas.';
  }

  const shared = interestsA.filter((item) => interestsB.includes(item));
  const interestBonus = Math.min(8, shared.length * 3);
  const finalScore = Math.min(99, baseScore + interestBonus);

  const sharedText =
    shared.length > 0
      ? `Afinidades em comum: ${shared.slice(0, 3).join(', ')}.`
      : `Troca inspiradora entre ${infoA.symbol} ${infoA.name} e ${infoB.symbol} ${infoB.name}.`;

  return {
    score: finalScore,
    summary: `${elementNote} ${sharedText}`,
  };
}
