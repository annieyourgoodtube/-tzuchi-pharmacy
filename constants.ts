
import { Medication } from './types';

export const INITIAL_MEDICATIONS: Medication[] = [
  {
    id: '1',
    name: '普拿疼',
    englishName: 'Panadol',
    scientificName: 'Acetaminophen',
    specification: '500mg',
    location: 'A-01-05',
    description: '解熱鎮痛'
  },
  {
    id: '2',
    name: '伯基',
    englishName: 'Bokey',
    scientificName: 'Aspirin',
    specification: '100mg',
    location: 'B-02-12',
    description: '抗血小板凝集'
  },
  {
    id: '3',
    name: '冠達悅',
    englishName: 'Adalat OROS',
    scientificName: 'Nifedipine',
    specification: '30mg',
    location: 'C-05-01',
    description: '降血壓'
  },
  {
    id: '4',
    name: '耐適恩',
    englishName: 'Nexium',
    scientificName: 'Esomeprazole',
    specification: '40mg',
    location: 'A-10-02',
    description: '胃食道逆流'
  }
];
