import { Day } from '../models/travel.models';

/**
 * Données de voyage – compléter les jours manquants.
 * Structure identique à l'original data-days.js.
 */
export const DAYS_DATA: Day[] = [
    {
      id: "j1",
      navLabel: "Ven. 15 mai",
      content: {
        title: "Vendredi 15 mai – Arrivée Shanghai → Train pour Pékin",
        subtitle: "Atterrissage Pudong · Repos à l'hôtel · Train de nuit pour Pékin",
        badges: [
          { text: "Paris → Shanghai → Pékin ", class: "badge-zone" },
        ],
        timeline: [
          { time: "10h50", color: "orange", content: "Arrivée Pudong International Airport (PVG)" },
          { time: "~12h00", color: "orange", content: "Sortie douane + bagages (compter 1h–1h30 pour l'immigration)" },
          { time: "~12h30", color: "orange", content: "Transfer vers chez LM Shanghai (Maglev + metro L2 ou taxi ~200 CNY)" },
          { time: "13h–15h30", color: "gray", content: "Repos chez LM · Déjeuner libre sur place" },
          { time: "15h30", color: "blue", content: "Départ → Hongqiao Railway Station (prévoir 1h de trajet)" },
          { time: "17h00", color: "blue", content: "Train Shanghai Hongqiao → Beijing Nan (G train, durée ~4h30)" },
          { time: "~21h30", color: "green", content: "Arrivée Beijing South Station (taxi ou metro vers l'hôtel)" },
          { time: "~22h00", color: "green", content: "Arrivée à l'hôtel Pékin · Dîner léger à proximité" }
        ],
        slots: [
          {
            type: "morning",
            icon: "✈️",
            time: "10h50",
            name: "Arrivée Pudong Airport",
            activities: [
              {
                name: "Arrivée + Immigration + Transfer vers hôtel",
                badges: [
                  { text: "~2h", class: "badge-duration" }
                ],
                grid: [
                  { label: "Immigration", value: "Compter 45 min–1h30. File \"Foreigners\" uniquement." },
                  { label: "Transport Didi réservé par LM", value: "Maglev (50 CNY, 8 min) → Longyang Road → metro L2 vers centre" }
                ]
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "13h00 – 15h30",
            name: "Repos et déjeuner – Voir avec LM",
            meal: "Déjeuner léger avec LM à proximité. Profitez-en pour recharger les téléphones, vérifier les billets de train, configurer <em>VPN</em>, <em>Didi</em> et <em>Alipay</em>. Aucun effort touristique aujourd'hui — l'objectif est d'être frais pour Pékin."
          },
          {
            type: "transit",
            icon: "🚄",
            time: "17h00",
            name: "Train Shanghai Hongqiao → Beijing Nan",
            activities: [
              {
                name: "Train G (haute vitesse) Shanghai Hongqiao → Beijing South",
                badges: [],
                grid: [
                  { label: "Gare départ", value: "Shanghai Hongqiao Railway Station. Départ hôtel : 15h30 (compter 1h de trajet + 45 min avant)." },
                  { label: "Gare arrivée", value: "Beijing South Station. Arrivée ~21h30–22h." },
                  { label: "Durée", value: "4h30–5h (train G direct)" },
                  { label: "Obligatoire", value: "Passeport original pour scan au portique quai" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis hôtel Jing'an : metro L2 ou L10 → Hongqiao Railway Station (~35 min). Départ hôtel 15h30 au plus tard."
                },
                tip: "Les trains G du soir se remplissent vite en haute saison. Réserver dès que possible. Arriver à la gare 45–60 min avant : contrôle passeport + sécurité + orientation dans la grande gare."
              }
            ]
          }
        ],
        alerts: {
          title : "✅ Checklist jour d'arrivee",
          points: [
          "<strong>VPN</strong> : Activé AVANT l'atterrissage (impossible à télécharger une fois en Chine)",
          "<strong>Didi</strong> : Installer avant le départ, indispensable pour les taxis"
        ]
        }
        
      }
    },
    {
      id: "j2",
      navLabel: "Sam. 16 mai",
      content: {
        title: "Samedi 16 mai – Grande Muraille + Wangfujing",
        subtitle: "Mutianyu le matin · Wangfujing l'après-midi · Soirée anniversaire surprise",
        badges: [
          { text: "Pékin", class: "badge-zone" },
          { text: "🎂 Anniversaire LM le soir", class: "badge-new" }
        ],
        timeline: [
          { time: "7h00", color: "orange", content: "Départ hôtel → Grande Muraille Mutianyu" },
          { time: "~8h30", color: "orange", content: "Arrivée Mutianyu – téléphérique + balade sur la Muraille" },
          { time: "~12h30", color: "gray", content: "Retour vers centre Pékin" },
          { time: "13h00–15h00", color: "gray", content: "Déjeuner rapide à Huairou ou en route" },
          { time: "15h00", color: "blue", content: "Wangfujing Street + Snack Street (Donghuamen)" },
          { time: "17h00", color: "blue", content: "Retour hôtel – repos avant soirée" },
          { time: "19h30", color: "green", content: "Soirée anniversaire LM (Surprise)" }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "7h00 – 13h00",
            name: "Matin – Grande Muraille de Chine (Mutianyu)",
            activities: [
              {
                name: "Grande Muraille – Section Mutianyu",
                badges: [
                  { text: "4h sur place", class: "badge-duration" },
                  { text: "Réservation recommandée", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Horaires", value: "7h30–18h00 (haute saison mai)" },
                  { label: "Entrée", value: "65 CNY (~8 EUR/pers). Téléphérique A/R : 120 CNY. Toboggan descente : 80 CNY." },
                  { label: "Transport", value: "Minivan privé recommandé (~600 CNY pour 2, ~1h15). Ou Didi ~300–400 CNY A/R." },
                  { label: "Accessibilité", value: "Téléphérique pour monter, toboggan ou télécabine pour descendre. Bonne signalisation EN." },
                  { label: "Réservation", value: "Trip.com ou Klook (entrée + téléphérique)" },
                  { label: "Adresse", value: "Huairou District, 70 km nord de Pékin" }
                ],
                transport: {
                  icon: "🚕",
                  text: "Depuis hôtel Pékin : Didi ou minivan privé (~1h15–1h30). Départ à 7h00 pour arriver avant les groupes de 9h."
                },
                tip: "Mutianyu = section la plus photogénique, moins bondée que Badaling. Prendre le téléphérique pour monter, le toboggan pour descendre. Explorer vers les tours 14–20 pour avoir la muraille pour soi. Retour visé vers 12h30–13h00."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "13h00 – 15h00",
            name: "Déjeuner – Retour vers centre Pékin",
            meal: "Déjeuner rapide à Huairou ou en route. Arrivée centre Pékin vers 14h30–15h00. Budget : 50–80 CNY/pers."
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "15h00 – 17h00",
            name: "Après-midi – Wangfujing Street",
            activities: [
              {
                name: "Wangfujing Street et Snack Street (Donghuamen)",
                badges: [
                  { text: "2h", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "Ouvert en continu (boutiques 10h–22h)" },
                  { label: "Entrée", value: "Gratuit" },
                  { label: "Adresse", value: "Dongcheng District (à l'est de la Cité Interdite)" },
                  { label: "Accessibilité", value: "Bilingue EN/CN, très touristique" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro L1 → Wangfujing Station, sortie A"
                },
                tip: "La Snack Street (Donghuamen Night Market) propose brochettes de scorpions, étoiles de mer et fruits exotiques. Wangfujing = grande rue commerçante de Pékin. Idéal pour acheter thés, soieries, calligraphie."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍽️",
            time: "19h30 – 21h30",
            name: "Dîner d'anniversaire – 3 options",
            activities: [
              {
                name: "Dali Courtyard (大理云南菜)",
                badges: [
                  { text: "⭐ Recommandé", class: "badge-new" }
                ],
                grid: [
                  {
                    label: "Cuisine",
                    value:
                      "Yunnan (Dali) — légère, aromatique, parfaite après un marathon (pas trop lourde ni grasse)"
                  },
                  {
                    label: "Ambiance",
                    value:
                      "Cour intérieure hutong, tables sous les arbres, bougies, calme et romantique"
                  },
                  {
                    label: "Menu fixe",
                    value:
                      "~200 CNY/pers — idéal pour commander sans effort après une longue journée"
                  },
                  {
                    label: "Accessibilité",
                    value:
                      "Staff anglophone, très habitué aux étrangers"
                  },
                  {
                    label: "Adresse",
                    value:
                      "67 Xiaojingchang Hutong, Dongcheng District"
                  },
                  {
                    label: "Réservation",
                    value:
                      'Appel ou WeChat, ou via <a href="https://www.trip.com" target="_blank">Trip.com</a>. Indispensable le samedi soir.'
                  }
                ],

                tip:
                  "Parfait pour LM fatigué : menu fixe = zéro effort de commande. Cuisine légère et nourrissante. Cour intérieure = calme absolu. Meilleure option pour la situation."
              },

              {
                name: "Da Dong Peking Duck – branche Jinbao Street",
                badges: [
                  { text: "Option 2", class: "badge-free" }
                ],
                grid: [
                  {
                    label: "Cuisine",
                    value:
                      "Canard laqué pékinois Michelin — l'incontournable de Pékin"
                  },
                  {
                    label: "Ambiance",
                    value:
                      "Élégant, service très attentionné, salons semi-privés disponibles"
                  },
                  {
                    label: "Budget",
                    value:
                      "300–400 CNY/pers (canard + quelques plats)"
                  },
                  {
                    label: "Anniversaire",
                    value:
                      "Le personnel organise volontiers une petite célébration (gâteau, bougie) si précisé à la réservation"
                  },
                  {
                    label: "Branche recommandée",
                    value:
                      "Da Dong Jinbao St (金宝汇) — plus calme que la branche Dongzhimen"
                  },
                  {
                    label: "Réservation",
                    value:
                      'Via <a href="https://www.trip.com" target="_blank">Trip.com</a> ou Chope Beijing. Mentionner "quiet table for birthday" à la réservation.'
                  }
                ],
                tip:
                  "Canard pékinois = expérience gastronomique emblématique de Pékin. Les bols de soupe de canard sont excellents pour la récupération après un effort."
              },

              {
                name: "King's Joy (京兆尹) – Végétarien Michelin",
                badges: [
                  { text: "Option 3", class: "badge-free" }
                ],
                grid: [
                  {
                    label: "Cuisine",
                    value:
                      "Végétarien créatif / Bouddhiste · Michelin 1 étoile"
                  },
                  {
                    label: "Ambiance",
                    value:
                      "Temple somptueux rénové, salons privés, musique douce, thé de cérémonie"
                  },
                  {
                    label: "Budget",
                    value:
                      "300–500 CNY/pers"
                  },
                  {
                    label: "Idéal marathonien",
                    value:
                      "Cuisine légère, anti-inflammatoire, excellente pour la récupération (tofu, légumes, bouillons)"
                  },
                  {
                    label: "Adresse",
                    value:
                      "2 Wudaoying Hutong, Dongcheng District (à côté du Lama Temple)"
                  },
                  {
                    label: "Réservation",
                    value:
                      'Via leur WeChat ou <a href="https://www.trip.com" target="_blank">Trip.com</a>'
                  }
                ],
                tip:
                  "Option la plus récupération pour LM. Cadre de temple = aucun bruit. Expérience unique à Pékin. Parfait si LM est vraiment épuisé."
              }
            ]
          },
          {
            type: "evening",
            icon: "🌙",
            time: "21h30 – 23h00",
            name: "Après dîner – 3 idées chill",
            activities: [
              {
                name: "Option A – Verre au bord de Houhai Lake",
                badges: [
                  { text: "Chill", class: "badge-free" }
                ],
                grid: [
                  {
                    label: "Ambiance",
                    value:
                      "Terrasses en bord de lac, lumières réfléchies, bateaux éclairés, brise douce en mai"
                  },
                  {
                    label: "Bar recommandé",
                    value:
                      "No Name Bar (无名酒吧) pour vue sur le lac, ou terrasses du Qianhai"
                  }
                ],

                tip:
                  "Trajet depuis restaurant : 10–15 min en Didi. Parfait pour s'asseoir, souffler et célébrer l'anniversaire avec un verre dans un cadre magnifique sans effort physique."
              },

              {
                name: "Option B – Bar à cocktails / Baijiu tasting en hutong",

                badges: [
                  { text: "Chill", class: "badge-free" }
                ],

                grid: [
                  {
                    label: "Recommandation",
                    value: "Capital Spirits (首府精酢) — spécialiste baijiu artisanal, Dongcheng"
                  },
                  {
                    label: "Ambiance",
                    value: "Petit bar cosy dans un hutong, expert en alcools chinois, anglophone"
                  }
                ],

                tip:
                  "Dégustation guidée de baijiu (alcool de sorgho) — expérience unique à Pékin. Ambiance intime et assise. Bar de niche fréquenté par les expats. Parfait pour 3 personnes."
              },
              {
                name: "Option C – Retour hôtel + gâteau surprise en chambre",
                badges: [
                  { text: "Ultra chill", class: "badge-free" }
                ],
                tip:
                  "Si LM est vraiment épuisé : commander un gâteau à l'avance auprès du concierge de l'hôtel (200–400 CNY, possible dans la plupart des hôtels 4/5 étoiles de Pékin). Simple, intime, et parfois ce dont un marathonien a le plus besoin."
              }
            ]
          }
        ],
        alerts: {
          title : "🏃 LM court un marathon samedi apres-midi",
          points : [
          "LM sera fatigué en soirée → soirée anniversaire <strong>très chill, aucun programme physique</strong>",
          "Prévoir un resto avec table confortable, service attentionné, ambiance feutrée, pas de bruit",
          "Voir l'onglet <strong>\"Anniversaire\"</strong> pour les recommandations détaillées",
          "Soirée à <strong>3 personnes</strong> → table intime, pas de grande tablée",
          "Ambiance <strong>feutrée et calme</strong> — pas de musique forte, pas de restaurant bruyant",
          "Dîner vers <strong>19h30–20h00</strong> — pas trop tardif pour un marathonien",
          "Pas d'activité physique après le dîner",
          "Choisir le restaurant parmi les 3 options et réserver dès que possible (samedi soir se remplit vite)",
          'À la réservation : mentionner "Birthday dinner for 3, very chill please, candles if possible"',
          "Option gâteau hôtel : contacter le concierge dès l'arrivée à l'hôtel le 15 mai au soir"
        ]}
      }
    },
    {
        id: "j3",
        navLabel: "Dim. 17 mai",
        content: {
          title: "Dimanche 17 mai – Temples, Hutongs et Art",
          badges: [{ text: "Pekin", class: "badge-zone" }],
          subtitle: "Temple du Ciel · Hutongs · 798 Art District · Houhai Lakes · Soiree libre",
          slots: [
            {
              type: "morning",
              icon: "🌅",
              time: "9h00 – 12h00",
              name: "Matin – Temple du Ciel et Hutongs",
              activities: [
                {
                  name: "Temple of Heaven (Temple du Ciel)",

                  badges: [
                    { text: "2h", class: "badge-duration" },
                    { text: "Sans reservation", class: "badge-free" }
                  ],

                  grid: [
                    {
                      label: "Horaires",
                      value:
                        "6h00–22h00 (parc). Edifices 8h00–17h30. Ouvert tous les jours."
                    },
                    {
                      label: "Entree",
                      value:
                        "15 CNY (parc seul). Billet combine tous edifices : 35 CNY (~4,40 EUR/pers)."
                    },
                    {
                      label: "Adresse",
                      value: "Tiantan East Road, Dongcheng District"
                    },
                    {
                      label: "Accessibilite",
                      value: "Bilingue EN, vaste parc accessible"
                    }
                  ],

                  transport: {
                    icon: "🚇",
                    text: "Metro L5 → Tiantan East Gate Station"
                  },

                  tip:
                    "Arriver tot (9h) pour voir les retraites faire du tai-chi dans le parc. Le Hall of Prayer for Good Harvests est l'edifice le plus photogenique de Pekin. Site UNESCO, cadre grandiose."
                },

                {
                  name: "Hutong Streets – balade libre",

                  badges: [
                    { text: "1h", class: "badge-duration" },
                    { text: "Gratuit", class: "badge-free" }
                  ],

                  grid: [
                    {
                      label: "Zone recommandee",
                      value:
                        "Nanluoguxiang ou Wudaoying Hutong (plus calme)"
                    },
                    {
                      label: "Option",
                      value:
                        "Rickshaw tour ~100–150 CNY/pers, 45 min"
                    }
                  ],

                  transport: {
                    icon: "🚇",
                    text:
                      "Depuis Temple du Ciel : metro L5 → Beixinqiao puis marche 10 min"
                  },

                  tip:
                    "Nanluoguxiang est touristique mais vivante avec cafes independants. Wudaoying Hutong est plus calme avec de bons restaurants. Idee originale de Pekin authentique."
                }
              ]
            },

            {
              type: "meal",
              icon: "🍜",
              time: "12h00 – 14h00",
              name: "Dejeuner – Hutong / Nanluoguxiang",
              meal: "Excellents restaurants locaux dans les hutongs. Essayez le <strong>zha jiang mian</strong> (nouilles au soja brun) ou le <strong>jian bing</strong> (crepe pekinoise). Nombreux cafes avec cour interieure. Budget : 40–80 CNY/pers."
            },
            {
              type: "afternoon",
              icon: "☀️",
              time: "14h00 – 18h00",
              name: "Apres-midi – 798 Art District et Houhai Lakes",

              activities: [
                {
                  name: "798 Art District",

                  badges: [
                    { text: "2h", class: "badge-duration" },
                    { text: "Entree libre", class: "badge-free" }
                  ],

                  grid: [
                    {
                      label: "Horaires",
                      value:
                        "Lun–dim 10h00–18h00 (galeries)"
                    },
                    {
                      label: "Entree",
                      value:
                        "Gratuit (expositions speciales payantes)"
                    },
                    {
                      label: "Adresse",
                      value:
                        "4 Jiuxianqiao Road, Chaoyang District"
                    },
                    {
                      label: "Accessibilite",
                      value:
                        "Bilingue EN/CN, galeries internationales"
                    }
                  ],

                  transport: {
                    icon: "🚕",
                    text:
                      "Didi depuis les hutongs (~20 min, ~30 CNY) — zone peu desservie par le metro"
                  },

                  tip:
                    "Ancien complexe d'usines militaires style Bauhaus reconverti en district d'art contemporain. Nombreuses galeries internationales, street art geant, cafes design. Moins frequente le dimanche apres-midi."
                },

                {
                  name: "Houhai Lakes (Shichahai) – promenade",

                  badges: [
                    { text: "1h30", class: "badge-duration" },
                    { text: "Gratuit", class: "badge-free" }
                  ],

                  grid: [
                    {
                      label: "Horaires",
                      value:
                        "Ouvert 24h/24 (lac exterieur)"
                    },
                    {
                      label: "Entree",
                      value:
                        "Gratuit (pourtour du lac)"
                    },
                    {
                      label: "Adresse",
                      value:
                        "Xicheng District"
                    },
                    {
                      label: "Accessibilite",
                      value:
                        "Promenade facile, nombreux bars et restaurants"
                    }
                  ],

                  transport: {
                    icon: "🚕",
                    text:
                      "Depuis 798 : Didi ~25 min. Ou metro L6 → Beihai North Station"
                  },

                  tip:
                    "Tres belle promenade autour des trois lacs imperiaux. Nombreux bars et restaurants sur les berges. Ambiance tres agreable en mai, ideal avant le diner."
                }
              ]
            },

            {
              type: "meal",
              icon: "🍽️",
              time: "18h00 – 20h00",
              name: "Diner libre – Houhai / Wudaoying",
              meal: "Restaurants avec terrasse sur les bords du lac Houhai. Ambiance detenue et romantique. Budget : 80–150 CNY/pers. Wudaoying Hutong a 10 min propose des restaurants locaux moins chers."
            },

            {
              type: "evening",
              icon: "🌙",
              time: "20h00 – 23h00",
              name: "Soiree – Chill libre",

              activities: [
                {
                  name:
                    "Soiree libre – Bars Houhai ou retour a l'hotel",

                  badges: [{ text: "No plan", class: "badge-free" }],

                  grid: [
                    {
                      label: "Option A",
                      value:
                        "Verre sur les berges de Houhai (terrasses, bateaux eclaires, brise douce)"
                    },
                    {
                      label: "Option B",
                      value:
                        "Retour hotel, massages ou spa a proximite"
                    }
                  ],

                  tip:
                    "Les lacs de Houhai sont particulierement beaux la nuit en mai avec les lumieres reflechies. Ambiance detenue et locale, parfaite pour une soiree sans objectif."
                }
              ]
            }
          ]
        }
    },
    {
      id: "j4",
      navLabel: "Lun. 18 mai",
      content: {
        title: "Lundi 18 mai – Palais d'Été → Cité Interdite → Train retour",
        subtitle: "Summer Palace le matin · Tiananmen + Cité Interdite + Jingshan l'après-midi · Train de retour",
        badges: [
          { text: "Pékin → Shanghai", class: "badge-zone" }
        ],
        timeline: [
          { time: "8h00",  color: "orange", content: "Summer Palace – entrée Est" },
          { time: "12h00", color: "yellow", content: "Déjeuner – En route vers Tiananmen" },
          { time: "13h30", color: "blue",   content: "Place Tiananmen" },
          { time: "14h00", color: "blue",   content: "Cité Interdite – Porte du Méridien" },
          { time: "16h15", color: "blue",   content: "Jingshan Park – panorama" },
          { time: "17h15", color: "red",    content: "Beijing South Station – embarquement" },
          { time: "17h30", color: "green",  content: "Départ train G → Shanghai Hongqiao" },
          { time: "22h00", color: "green",  content: "Arrivée Shanghai Hongqiao" }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "8h00 – 12h00",
            name: "Matin – Summer Palace (Palais d'Été)",
            activities: [
              {
                name: "Summer Palace (Yiheyuan) – UNESCO",
                badges: [
                  { text: "3h–3h30", class: "badge-duration" },
                  { text: "Réserver le 11 mai", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Horaires", value: "Parc 6h00–20h00. Édifices 8h00–18h00 (saison haute). Ouvert le lundi." },
                  { label: "Entrée", value: "30 CNY (~3,75 EUR). Billet combiné tous sites : 60 CNY (~7,50 EUR) — recommandé." },
                  { label: "Réservation", value: "WeChat « 颐和园 » (passeport requis) ou <a href=\"https://www.trip.com\" target=\"_blank\">Trip.com</a>. Ouvre 7 jours avant à 8h Pékin." },
                  { label: "Adresse", value: "19 Xinjian Gongmen Rd, Haidian District" },
                  { label: "Audio-guide", value: "Disponible en 19 langues à l'entrée Est" },
                  { label: "Surface", value: "2,9 km² — prévoir 3h minimum pour l'essentiel" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro L4 → Beigongmen Station (porte Nord) ou Xiyuan Station (porte Est). ~30 min depuis le centre."
                },
                tip: "Itinéraire recommandé : Entrée Est → Hall of Benevolence → Corridor Long (728 m de galerie peinte) → Marble Boat → Tour de l'Encens Bouddhiste → Dike Ouest pour les vues. Bateau vapeur sur le lac : 10–20 CNY."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "12h00 – 13h30",
            name: "Déjeuner rapide – En route vers Tiananmen",
            meal: "Déjeuner léger dans le quartier ou cafétéria du Palais d'Été. Trajet métro vers Tiananmen : ~30 min (L4 → L1 Tiananmen East). Partir à 12h30 pour être sur place à 13h30."
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "13h30 – 16h15",
            name: "Après-midi – Tiananmen + Cité Interdite + Jingshan",
            activities: [
              {
                name: "Place Tiananmen",
                badges: [
                  { text: "30 min", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "5h30–22h00 (contrôle sécurité requis)" },
                  { label: "Entrée", value: "Gratuit mais contrôle passeport à l'entrée" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro L1 → Tiananmen East, sortie A"
                },
                tip: "Passage rapide pour la photo emblématique face au portrait de Mao. Traverser vers le nord pour rejoindre la Porte du Méridien (entrée sud de la Cité Interdite)."
              },
              {
                name: "Cité Interdite (Forbidden City / Palace Museum)",
                badges: [
                  { text: "2h–2h30", class: "badge-duration" },
                  { text: "Réserver le 11 mai à 14h (France)", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Horaires", value: "Mar–dim 8h30–17h00 (dernière entrée 16h00). Normalement fermé le lundi — vérifier pour le 18 mai." },
                  { label: "Entrée", value: "60 CNY (~7,50 EUR/pers). Galeries Trésor/Horloges : +10 CNY chacune." },
                  { label: "Réservation", value: "pm.e.cn ou Trip.com/Klook. Tickets dispo 7 jours avant à 20h Pékin (14h France)." },
                  { label: "Important", value: "40 000 visiteurs/jour max. Vendu en 10–15 min en haute saison." },
                  { label: "Passeport", value: "Original obligatoire pour scan à la Meridian Gate" },
                  { label: "Accessibilité", value: "Bilingue EN, 72 ha — chaussures confortables indispensables" }
                ],
                transport: {
                  icon: "🚶",
                  text: "Depuis Tiananmen : à pied vers la Porte du Méridien (5 min nord)"
                },
                tip: "Parcours recommandé : Meridian Gate → Cour des Lions → Grandes Salles du Trône → Palais Intérieurs → Porte Shenwu (sortie nord vers Jingshan). Si fermé le lundi : remplacer par Lama Temple (ouvert tous les jours, entrée 25 CNY)."
              },
              {
                name: "Jingshan Park – Panorama sur la Cité Interdite",
                badges: [
                  { text: "45 min", class: "badge-duration" },
                  { text: "Entrée libre", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "6h00–21h00 (mai)" },
                  { label: "Entrée", value: "2 CNY (~0,25 EUR)" },
                  { label: "Vue", value: "Panorama complet sur toute la Cité Interdite depuis le Pavillon Wanchun" },
                  { label: "Timing", value: "Être au sommet avant 16h00 pour avoir le temps de descendre et rejoindre la gare" }
                ],
                transport: {
                  icon: "🚶",
                  text: "Sortir par la Porte Shenwu (nord) de la Cité Interdite → 2 min à pied vers Jingshan"
                },
                tip: "Vue aérienne incontournable sur la Cité Interdite : LA photo de fin de séjour. Montée 10 min à pied depuis l'entrée. Quitter Jingshan à 16h15 pour être à Beijing Nan à 17h15."
              }
            ]
          },
          {
            type: "transit",
            icon: "🚄",
            time: "17h30 – 22h30",
            name: "Train retour Beijing Nan → Shanghai Hongqiao",
            activities: [
              {
                name: "Train G (haute vitesse) Beijing South → Shanghai Hongqiao",
                badges: [
                  { text: "À RÉSERVER DÈS QUE POSSIBLE", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Gare départ", value: "Beijing South Station (北京南). Quitter Jingshan à 16h15 → métro L5→L4 → Beijing Nan (~1h)." },
                  { label: "Départ suggéré", value: "Train 17h30 ou 18h00 → arrivée Hongqiao ~22h00–22h30" },
                  { label: "Durée", value: "4h18 (G direct) à 5h30" },
                  { label: "Prix 2e classe", value: "553–673 CNY (~69–84 EUR/pers)" },
                  { label: "Réservation", value: "Trip.com. Ouverture 15 jours avant." },
                  { label: "Passeport", value: "Original obligatoire pour scan au portique quai" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis Jingshan : métro L5 → Chongwenmen → L14 → Beijing Nan (~50 min). Ou Didi direct ~30 min."
                },
                tip: "Train de 18h30 possible en secours si la Cité Interdite prend plus longtemps, avec arrivée Hongqiao ~23h00. Ne pas dépasser 19h00 de départ pour rester raisonnable."
              }
            ]
          }
        ],
        alerts: {
          title: "⚠️ Rappels urgents – Actions à faire maintenant",
          points: [
            "<strong>Summer Palace (18 mai)</strong> : Réserver le <strong>lundi 11 mai à 8h00 heure Pékin (2h du matin France)</strong> sur WeChat ou Trip.com. Tickets ouverts 7 jours avant.",
            "<strong>Cité Interdite (18 mai)</strong> : Attention normalement fermée le lundi. Tickets libérés le <strong>lundi 11 mai à 20h00 heure Pékin (14h France)</strong>. 40 000 visiteurs/jour max — vendu en 10–15 min en haute saison. Mettre un rappel MAINTENANT.",
            "<strong>Train retour Pékin → Shanghai</strong> : Réserver sur Trip.com. Départ suggéré <strong>17h30 ou 18h00</strong> depuis Beijing Nan → arrivée Hongqiao ~22h00–22h30.",
            "<strong>Vérification</strong> : La Cité Interdite est normalement fermée le lundi — vérifier si le 18 mai fait exception sur pm.e.cn."
          ]
        }
      }
    },
    {
      id: "j5",
      navLabel: "Mar. 19 mai",
      content: {
        title: "Mardi 19 mai – Jing'an & Suzhou Creek",
        subtitle: "Temples, galeries d'art contemporain, architecture spectaculaire",
        badges: [
          { text: "Zone Jing'an", class: "badge-zone" }
        ],
        timeline: [
          { time: "9h00",  color: "orange", content: "M50 Art District – Moganshan Road" },
          { time: "10h15", color: "orange", content: "1000 Trees – Heatherwick" },
          { time: "12h00", color: "yellow", content: "Déjeuner – Nanjing West Road" },
          { time: "14h00", color: "blue",   content: "Temple du Bouddha de Jade" },
          { time: "18h00", color: "yellow", content: "Dîner – quartier Jing'an" },
          { time: "20h00", color: "purple", content: "Musée d'Histoire Naturelle illuminé + Sculpture Park" }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "9h00 – 12h00",
            name: "Matin",
            activities: [
              {
                name: "M50 Art District",
                badges: [
                  { text: "1h", class: "badge-duration" },
                  { text: "Entrée libre", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "Lun–dim 10h00–18h00 (galeries 11h–18h)" },
                  { label: "Entrée", value: "Gratuit (expos spéciales payantes)" },
                  { label: "Adresse", value: "50 Moganshan Road, Putuo" },
                  { label: "Accessibilité", value: "Bonne, certaines galeries EN" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis Jing'an Temple : métro L13 → Jiangning Road + 10 min à pied (15 min total)"
                },
                tip: "Vérifier sur WeChat/Instagram les expos en cours. Café dans la vieille tour d'eau (Building 8)."
              },
              {
                name: "1000 Trees (Tian An 1000 Trees)",
                badges: [
                  { text: "30–45 min", class: "badge-duration" },
                  { text: "Entrée libre", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "Lun–dim 10h00–22h00" },
                  { label: "Entrée", value: "Gratuit (forêt verticale)" },
                  { label: "Adresse", value: "600 Moganshan Road" },
                  { label: "Accessibilité", value: "Parfaitement balisé EN" }
                ],
                transport: {
                  icon: "🚶",
                  text: "5 min à pied de M50 vers le nord le long de Suzhou Creek"
                },
                tip: "Architecture spectaculaire de Thomas Heatherwick couverte d'arbres. Superbe pour les photos. Nombreux cafés et boutiques design sur plusieurs niveaux."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "12h00 – 14h00",
            name: "Déjeuner – Nanjing West Road",
            meal: "Nombreux restaurants autour de Jing'an Temple et Jing'an Kerry Centre. Essayez le <em>shengjianbao</em> (bao frit croustillant). Budget : 50–100 CNY/pers."
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "14h00 – 18h00",
            name: "Après-midi",
            activities: [
              {
                name: "Temple du Bouddha de Jade (Jade Buddha Temple)",
                badges: [
                  { text: "1h30–2h", class: "badge-duration" },
                  { text: "Sans réservation", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "Lun–dim 8h30–17h00" },
                  { label: "Entrée", value: "20 CNY (~2,50 €) · Pavillon jade +10 CNY" },
                  { label: "Adresse", value: "170 Anyuan Road, Putuo District" },
                  { label: "Accessibilité", value: "Panneaux bilingues CN/EN" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis logement Jing'an : métro ligne 7 → Changshou Road (10 min) ou taxi ~15 CNY"
                },
                tip: "Arriver dès 8h30 pour éviter les groupes de pèlerins. Tenues couvrantes recommandées (épaules + genoux couverts). Pas de trépied ni selfie stick autorisé."
              },
              {
                name: "Shanghai Tower – Observation deck 118e étage (Top of Shanghai)",
                badges: [
                  { text: "1h30–2h", class: "badge-duration" },
                  { text: "Réservation obligatoire", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Horaires", value: "Lun–dim 8h30–21h30 · dernière entrée 20h30" },
                  { label: "Entrée", value: "180 CNY (~22,50 €) adulte · créneau horaire à choisir à la réservation · passeport obligatoire" },
                  { label: "Hauteur", value: "118e étage · 546 m · 2e plus haute plateforme du monde" },
                  { label: "Adresse", value: "501 Yincheng Middle Road, Lujiazui, Pudong" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro ligne 2 ou 14 → Lujiazui Station, sortie 6 ou 8 · 10–15 min depuis le centre"
                },
                tip: "Réserver en ligne à l'avance (Trip.com, Klook ou site officiel) : les créneaux du soir partent vite et le passeport est requis. Viser le créneau coucher de soleil (18h–19h) pour voir la ville à la fois en journée et illuminée — les trois tours Lujiazui (Jin Mao + SWFC + Shanghai Tower) vues du dessus depuis l'ascenseur à 65 km/h sont déjà un spectacle. Étage 126 accessible avec supplément pour voir l'amortisseur anti-vent de 1 000 tonnes."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍽️",
            time: "18h00 – 20h00",
            name: "Dîner – quartier Jing'an",
            meal: "Retour au quartier Jing'an. Restaurant végétarien du Temple Jing'an (Suzhai, ouvert 17h–20h30) ou restaurants modernes Kerry Centre / Réel Mall."
          },
          {
            type: "evening",
            icon: "🌙",
            time: "20h00 – 23h00",
            name: "Soirée",
            activities: [
              {
                name: "Musée d'Histoire Naturelle – extérieur illuminé + Jing'an Sculpture Park",
                badges: [
                  { text: "1h promenade", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Note", value: "Visite intérieure prévue J2. Ce soir : extérieur du bâtiment escargot + parc sculpté" },
                  { label: "Adresse", value: "510 Beijing West Road (Jing'an Sculpture Park)" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro L13 → Natural History Museum Station (15 min depuis 1000 Trees)"
                },
                tip: "Le bâtiment en forme de coquillage est particulièrement beau la nuit. Le parc sculpté reste ouvert en soirée. Un verre dans un bar de Xinhua Road à 10 min à pied."
              }
            ]
          }
        ]
      }
    },
    {
      id: "j6",
      navLabel: "Mer. 20 mai",
      content: {
        title: "Mercredi 20 mai – Centre & Bund",
        subtitle: "Musées, shopping, coucher de soleil sur le Huangpu",
        badges: [
          { text: "People's Square / Bund", class: "badge-zone" }
        ],
        timeline: [
          { time: "9h00",  color: "orange", content: "Musée d'Histoire Naturelle de Shanghai" },
          { time: "12h00", color: "yellow", content: "Déjeuner – People's Square" },
          { time: "14h00", color: "blue",   content: "Zoo ?" },
          { time: "18h00", color: "yellow", content: "Dîner – The Bund" },
          { time: "20h00", color: "orange", content: "Nanjing Road – promenade vers le Bund" },
          { time: "20h45", color: "purple", content: "The Bund – coucher de soleil & lumières nocturnes" }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "9h00 – 12h00",
            name: "Matin",
            activities: [
              {
                name: "Musée d'Histoire Naturelle de Shanghai",
                badges: [
                  { text: "2h30–3h", class: "badge-duration" },
                  { text: "Réservation recommandée", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Horaires", value: "Mar–dim 9h00–17h00 (dernière entrée 16h). Fermé lundi." },
                  { label: "Entrée", value: "30 CNY (~3,70 €/pers) · Gratuit -6 ans / +70 ans" },
                  { label: "Réservation", value: "snhm.org.cn ou caisse à l'ouverture" },
                  { label: "Accessibilité", value: "Excellent EN, ascenseurs, rampes" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis logement Jing'an : métro L13 → Natural History Museum Station, Sortie 1 (5 min)"
                },
                tip: "Arriver à 9h à l'ouverture pour éviter les groupes scolaires. 5 niveaux à explorer de haut en bas. Squelette de dinosaure géant au B1. Théâtres 4D : réserver sur place dès 9h."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "12h00 – 14h00",
            name: "Déjeuner – People's Square",
            meal: "Trajet ~15 min vers People's Square (L13 → L1). Déjeuner dans la galerie marchande de Raffles City ou rues autour de People's Square. Budget : 50–80 CNY/pers."
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "14h00 – 18h00",
            name: "Après-midi",
            activities: [
              {
                name: "Zoo ?",
                badges: [
                  { text: "4h ??", class: "badge-duration" },
                  { text: "Entrée gratuite", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "TODO" },
                  { label: "Adresse", value: "TODO" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro L1/L2/L8 → People's Square, sortie 1 – 2 min à pied"
                },
                tip: "TODO"
              }
            ]
          },
          {
            type: "meal",
            icon: "🍽️",
            time: "18h00 – 20h00",
            name: "Dîner – The Bund",
            meal: "Restaurants avec vue : <em>The House of Roosevelt</em>, <em>New Heights</em>, <em>M on the Bund</em>. Réservation recommandée pour tables vue. Budget : 200–400 CNY/pers. Alternative économique : ruelles derrière Nanjing Road."
          },
          {
            type: "evening",
            icon: "🌙",
            time: "20h00 – 23h00",
            name: "Soirée",
            activities: [
              {
                name: "Nanjing Road (promenade vers le Bund)",
                badges: [
                  { text: "45 min–1h", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Distance", value: "1,7 km à pied du musée au Bund" },
                  { label: "Trajet", value: "20 min à pied ou tram gratuit" }
                ],
                transport: {
                  icon: "🚶",
                  text: "Direction est sur Nanjing East Road depuis Shanghai Museum (25 min)"
                },
                tip: "\"China's No.1 Commercial Street\". Idéal pour shopping fin d'après-midi. Foule intense à partir de 17h — prévoir d'arriver au Bund vers 18h30."
              },
              {
                name: "The Bund – coucher de soleil & lumières nocturnes",
                badges: [
                  { text: "2h–2h30", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Coucher de soleil", value: "~19h05 le 20 mai → arriver 18h30" },
                  { label: "Promenade", value: "1,5 km de Waibaidu Bridge au sud" },
                  { label: "Accès", value: "Gratuit, ouvert 24h/24" },
                  { label: "Option croisière", value: "~110 CNY/pers (départs 19h–21h)" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Métro L2/L10 → East Nanjing Road, puis 10 min à pied"
                },
                tip: "Arriver 30–45 min avant le coucher de soleil pour un bon spot. La \"blue hour\" après le coucher est souvent plus photogénique. Attention aux pickpockets le soir."
              }
            ]
          }
        ]
      }
    },
    {
      id: "j7",
      navLabel: "Jeu. 21 mai",
      content: {
        title: "Jeudi 21 mai – Concession française & Vieille Ville",
        subtitle: "Yu Garden, Tianzifang, Xintiandi, soirée \"vieux Shanghai\"",
        badges: [
          { text: "French Concession", class: "badge-zone" }
        ],
        timeline: [
          { time: "9h00",  color: "orange", content: "Yu Garden + Bazar de Yuyuan" },
          { time: "12h00", color: "yellow", content: "Déjeuner – Bazar de Yuyuan" },
          { time: "14h00", color: "blue",   content: "Tianzifang – ruelles shikumen" },
          { time: "15h30", color: "blue",   content: "Xintiandi + Fuxing Park" },
          { time: "18h00", color: "yellow", content: "Dîner – Concession française" },
          { time: "20h00", color: "purple", content: "Xintiandi by night + Wukang Road" }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "9h00 – 12h00",
            name: "Matin",
            activities: [
              {
                name: "Yu Garden + Bazar de Yuyuan",
                badges: [
                  { text: "2h–2h30", class: "badge-duration" },
                  { text: "Réservation conseillée", class: "badge-tobook" }
                ],
                grid: [
                  { label: "Horaires", value: "Mar–dim 9h00–17h30 (dernière entrée 16h30). Fermé lundi." },
                  { label: "Entrée jardin", value: "40 CNY (~5 €/pers) · Bazar : gratuit" },
                  { label: "Réservation", value: "Via Trip.com ou Klook (évite la file)" },
                  { label: "Accessibilité", value: "Panneaux bilingues, quelques marches" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis logement Jing'an : métro L13 → People's Square + L10 → Yuyuan Garden (25 min)"
                },
                tip: "Arriver IMPÉRATIVEMENT à 9h — la foule explose à 10h30. Route : Grande Rocaille → 6 sections du jardin → Inner Garden. Les xiaolongbao de Nanxiang (pagode du lac) sont incontournables après la visite."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "12h00 – 14h00",
            name: "Déjeuner – Bazar de Yuyuan",
            meal: "Déjeuner dans le bazar : xiaolongbao au restaurant <em>Nanxiang</em>, dim sum traditionnels. Street food authentique dans les ruelles. Budget : 60–100 CNY/pers."
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "14h00 – 18h00",
            name: "Après-midi",
            activities: [
              {
                name: "Tianzifang",
                badges: [
                  { text: "1h–1h30", class: "badge-duration" },
                  { text: "Entrée libre", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "Boutiques 10h00–22h00 (variable)" },
                  { label: "Entrée", value: "Gratuit" },
                  { label: "Adresse", value: "Rue Taikang, Xuhui District" },
                  { label: "Accessibilité", value: "Ruelles étroites, panneaux EN" }
                ],
                transport: {
                  icon: "🚇",
                  text: "Depuis Yuyuan : métro L10 → Dapuqiao (15 min) puis 5 min à pied"
                },
                tip: "Labyrinthe de maisons shikumen converties en galeries, cafés et boutiques artisanales. Idéal l'après-midi avant la foule du soir. Souvenirs originaux : laque, gravure, porcelaine."
              },
              {
                name: "Xintiandi + Fuxing Park",
                badges: [
                  { text: "1h–1h30", class: "badge-duration" },
                  { text: "Entrée libre", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires", value: "Lun–dim 10h00–23h00 (restaurants)" },
                  { label: "Entrée", value: "Gratuit (quartier piéton)" },
                  { label: "Adresse", value: "Taicang Road & Huangpi South Road" },
                  { label: "Accessibilité", value: "Excellent EN, quartier expatriés" }
                ],
                transport: {
                  icon: "🚶",
                  text: "10 min à pied de Tianzifang vers le nord"
                },
                tip: "Fuxing Park : le parc aux platanes de la concession française, pause calme avant la soirée. Xintiandi : ambiance café-terrasse franco-shanghaïenne très agréable."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍽️",
            time: "18h00 – 20h00",
            name: "Dîner – Concession française",
            meal: "Meilleure zone gastronomique de Shanghai. Restaurants français, fusion, shanghaïens sur Huaihai Road et Wukang Road. Budget : 100–200 CNY/pers. Réservation conseillée."
          },
          {
            type: "evening",
            icon: "🌙",
            time: "20h00 – 23h00",
            name: "Soirée",
            activities: [
              {
                name: "Xintiandi by night + Wukang Road",
                badges: [
                  { text: "2h–3h", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Ambiance", value: "Terrasses animées, ruelles pavées éclairées" },
                  { label: "Wukang Mansion", value: "Bâtiment art déco triangulaire spectaculaire de nuit" },
                  { label: "Bars", value: "Constellation Bar (Xintiandi), Speak Low (cocktails)" },
                  { label: "Accessibilité", value: "Parfait pour les non-mandarins" }
                ],
                transport: {
                  icon: "🚶",
                  text: "Depuis restaurant : 5–10 min à pied dans le quartier"
                },
                tip: "Ambiance \"vieux Shanghai\" très romantique. Le Wukang Mansion (croisement Wukang/Huaihai) est spectaculaire la nuit — LE spot photo de Shanghai en ce moment."
              }
            ]
          }
        ]
      }
    },
    {
      id: "j8",
      navLabel: "Ven. 22 mai",
      content: {
        title: "Vendredi 22 mai – Excursion Luzhi + LV The Boat le soir",
        subtitle:
          "Cité de l'eau millénaire, 41 ponts de pierre, canaux secrets, retour soirée Shanghai",
        badges: [
          { text: "Suzhou / Luzhi", class: "badge-zone" },
        ],
        timeline: [
          {
            time: "7h30",
            color: "orange",
            content:
              "Départ Jing'an → Shanghai Railway Station <em>(métro L1, 20 min)</em>"
          },
          {
            time: "8h00",
            color: "orange",
            content:
              "Train Shanghai → Suzhou <em>(25–35 min, 40–52 CNY/pers 2e classe)</em>"
          },
          {
            time: "8h40",
            color: "orange",
            content:
              "Suzhou Railway Station → métro L2 direction Sangtiandao → Jingu Road <em>(~35 min)</em>"
          },
          {
            time: "9h20",
            color: "orange",
            content:
              "Jingu Road exit 2 → bus 563 direction Luzhi <em>(~20 min)</em>"
          },
          {
            time: "9h45",
            color: "orange",
            content:
              "Entrée Luzhi Ancient Town – billet 78 CNY à la billetterie Xiaoshi Road"
          },
          {
            time: "12h30",
            color: "gray",
            content:
              "Déjeuner à Luzhi <em>(jarret de porc Fulitang, nouilles Aozao)</em>"
          },
          {
            time: "14h00",
            color: "blue",
            content:
              "Après-midi : Baosheng Temple + Shen Residence + promenade ponts et canaux"
          },
          {
            time: "15h45",
            color: "blue",
            content:
              "⚠️ Départ vers l'arrêt bus Luzhi → bus 563 → Jingu Road <em>(dernier retour raisonnable avant fermeture 17h00)</em>"
          },
          {
            time: "16h10",
            color: "blue",
            content:
              "Jingu Road → métro L2 → Suzhou Railway Station <em>(~35 min)</em>"
          },
          {
            time: "17h00",
            color: "gray",
            content:
              "Train Suzhou → Shanghai <em>(30 min — réserver à l'avance !)</em>"
          },
          {
            time: "17h35",
            color: "gray",
            content:
              "Arrivée Shanghai + dîner à Xintiandi <em>(métro L1, 20 min depuis Shanghai Railway Station)</em>"
          },
          {
            time: "20h30",
            color: "green",
            content:
              "LV The Boat – extérieur illuminé + promenade bord de lac"
          },
          {
            time: "21h30",
            color: "green",
            content:
              "Retour logement Jing'an"
          }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "9h45 – 12h30",
            name: "Matin à Luzhi",
            activities: [
              {
                name:
                  "Luzhi Ancient Town – 41 ponts de pierre, canaux, ruelles, balade en bateau",
                badges: [
                  { text: "2h30", class: "badge-duration" },
                  {
                    text: "Billetterie entrée Xiaoshi Road",
                    class: "badge-tobook"
                  }
                ],
                grid: [
                  {
                    label: "Horaires",
                    value: "8h00–17h00 (entrée 17h00 au plus tard)"
                  },
                  {
                    label: "Entrée",
                    value:
                      "78 CNY (~9,80 €) – inclut Baosheng Temple, Shen Residence, Xiao Residence, Wansheng Rice Shop, Jiangnan Cultural Garden"
                  },
                  {
                    label: "Bateau",
                    value: "100 CNY/barque (~4 pers), ~20 min"
                  },
                  {
                    label: "Accessibilité",
                    value: "Petite ville (1 km²) — tout à pied. Peu de panneaux EN — prévoir appli traduction"
                  }
                ],
                transport: {
                  icon: "🚌",
                  text:
                    "Depuis Jingu Road (exit 2) : bus 563 direction Luzhi, arrêt Luzhiguzhen (~20 min). Bus toutes les 15–20 min."
                },
                tip:
                  "Commencer par les ponts emblématiques en matinée : le Dongmei Bridge (structure circulaire unique, mi-dessus mi-dessous de l'eau) et les doubles ponts « trois pas deux ponts » Sanyuan + Wan'an. Prendre le bateau tôt (100 CNY/barque, 4 pers) avant que la lumière monte."
              }
            ]
          },
          {
            type: "meal",
            icon: "🍜",
            time: "12h30 – 14h00",
            name: "Déjeuner à Luzhi",
            meal:
              "Spécialités de Luzhi : <em>Jarret de porc Fulitang</em> (pied de porc braisé, plat signature de la ville), <em>Canard Fuli</em>, <em>Aozao Mian</em> (nouilles en bouillon — incontournable local). Restaurants sur Xihui Shangtang Street et Xihui Xiatang Street le long des canaux. Budget : 50–80 CNY/pers. Éviter les devantures trop touristiques en façade de rue principale."
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "14h00 – 15h45",
            name: "Après-midi à Luzhi",
            activities: [
              {
                name:
                  "Baosheng Temple – Temple bouddhiste du VIe siècle, Arhats de la dynastie Tang",
                badges: [
                  { text: "45 min–1h", class: "badge-duration" },
                  { text: "Inclus dans le billet", class: "badge-free" }
                ],
                grid: [
                  {
                    label: "Histoire",
                    value:
                      "Fondé en 503 AD, classé Monument National depuis 1961"
                  },
                  {
                    label: "Trésor",
                    value:
                      "9 statues d'Arhats en argile de la dynastie Tang — uniques en Chine"
                  },
                  {
                    label: "Classement",
                    value: "UNESCO Tentative List (Jiangnan Water Towns) depuis 2008"
                  },
                  {
                    label: "Accessibilité",
                    value: "Quelques panneaux bilingues"
                  }
                ],
                tip:
                  "Joyau absolu de Luzhi. Les statues d'Arhats en argile de Yang Huizhi (Tang) sont considérées comme un trésor national unique en Jiangnan. Moins bondé qu'un jardin UNESCO, l'atmosphère y est recueillie et authentique."
              },
              {
                name: "Shen Residence + Women's Costume Museum + Wansheng Rice Shop + ponts libres",
                badges: [
                  { text: "45 min–1h", class: "badge-duration" },
                  { text: "Inclus dans le billet", class: "badge-free" }
                ],
                grid: [
                  {
                    label: "Shen Residence",
                    value:
                      "Demeure seigneuriale Qing de 3 500 m², sculptures sur bois"
                  },
                  {
                    label: "Women's Costume Museum",
                    value:
                      "Costumes traditionnels des femmes de Luzhi — pièces indigo uniques"
                  },
                  {
                    label: "Wansheng Rice Shop",
                    value:
                      "Ancien négoce de riz reconverti en musée d'outils agricoles"
                  }
                ],
                transport: {
                  icon: "⚠️",
                  text:
                    "Quitter Luzhi à 15h45 au plus tard. Bus 563 depuis Luzhiguzhen → Jingu Road (~20 min). En secours : Didi (~60–80 CNY vers Suzhou Railway Station directement)."
                }
              },
              {
                name: "Retour vers Shanghai",
                badges: [
                  { text: "Billet à réserver", class: "badge-tobook" },
                ],
                grid: [
                  {
                    label: "16h10",
                    value:
                      "Métro L2 Jingu Road → Suzhou Railway Station (~35 min, ~5 CNY)"
                  },
                  {
                    label: "17h00",
                    value:
                      "Train Suzhou → Shanghai Railway Station (~30 min, 40–52 CNY)"
                  },
                  {
                    label: "17h35",
                    value:
                      "Arrivée Shanghai · métro L1 vers Xintiandi (20 min) · dîner ~18h30"
                  },
                ],
              }
            ]
          },
          {
            type: "evening",
            icon: "🌙",
            time: "20h30 – 22h00",
            name: "Soirée – LV The Boat (extérieur)",
            activities: [
              {
                name: "LV The Boat – Louis Vuitton Maison Shanghai",
                badges: [
                  { text: "45 min–1h", class: "badge-duration" },
                  { text: "Gratuit avec LM", class: "badge-free" }
                ],
                grid: [
                  { label: "Horaires extérieur", value: "Accessible en soirée, bâtiment illuminé" },
                  { label: "Adresse", value: "1 Dongping Road, Xuhui (lac Xintiandi)" },
                  { label: "Ambiance", value: "Bâtiment flottant illuminé, reflets sur l'eau" },
                  { label: "Intérieur", value: "Ouvert jusqu'à 22h si envie (gratuit)" }
                ],
                transport: {
                  icon: "🚶",
                  text: "Depuis Xintiandi (dîner) : 10 min à pied vers le lac Dongping"
                },
                tip: "La nuit, le bâtiment flottant de Thomas Heatherwick est illuminé — reflets spectaculaires sur l'eau, encore plus beau qu'en journée. Promenade autour du lac très agréable. Parfait pour clore le voyage."
              }
            ]
          },
        ],
        alerts: {
          title : "⚠️ Points critiques à anticiper pour cette journée",
          points : [
            "<strong>Trains Shanghai ↔ Suzhou</strong> : Réserver dès maintenant sur Trip.com. Départ ~7h45 depuis Shanghai Railway Station. Retour ~17h00 depuis Suzhou. Places limitées aux heures de pointe.",
            "<strong>Métro L2 + Bus 563</strong> : Depuis Suzhou Railway Station → L2 direction Sangtiandao → Jingu Road (exit 2) → bus 563 → arrêt Luzhiguzhen. Total ~55 min. Bus toutes les 15–20 min.",
            "<strong>Billet Luzhi</strong> : 78 CNY à la billetterie principale entrée Xiaoshi Road. Inclut tous les sites intérieurs. Entrée en ville possible sans billet mais sites fermés.",
            "<strong>Départ Luzhi à 15h45 au plus tard</strong> pour attraper le train ~17h00 à Suzhou avec marge. En secours : Didi (~60–80 CNY vers Suzhou Railway Station directement).",
          ]
        }
      }
    },
    {
      id: "j9",
      navLabel: "Sam. 23 mai",
      content: {
        title: "Samedi 23 mai – Journée Chill",
        subtitle: "Dernière journée à Shanghai – rythme libre avant le grand départ",
        badges: [
          { text: "Jour libre", class: "badge-zone" }
        ],
        timeline: [
          { time: "10h50", color: "orange", content: "Running matinal" },
          { time: "14h00", color: "blue",   content: "Chill / après-midi libre" },
          { time: "22h00", color: "red",    content: "Départ pour Pudong (voir J7)" }
        ],
        slots: [
          {
            type: "morning",
            icon: "🌅",
            time: "10h50 – 12h00",
            name: "Running",
            activities: [
              {
                name: "Running – Jing'an / Suzhou Creek",
                badges: [
                  { text: "1h", class: "badge-duration" },
                  { text: "Gratuit", class: "badge-free" }
                ],
                grid: [
                  { label: "Option A", value: "Suzhou Creek riverside path – plat, 5–8 km aller-retour" },
                  { label: "Option B", value: "Jing'an Sculpture Park + Nanjing West Road loop" },
                  { label: "Météo mai", value: "Prévoir sortie avant 11h pour éviter la chaleur" }
                ],
                transport: { icon: "🚶", text: "Départ depuis le logement" },
                tip: "Dernière course à Shanghai – profiter des platanes de la concession avant de boucler les valises."
              }
            ]
          },
          {
            type: "afternoon",
            icon: "☀️",
            time: "14h00 – 18h00",
            name: "Après-midi libre",
            activities: [
              {
                name: "Chill – programme au choix",
                badges: [
                  { text: "Jour libre", class: "badge-free" }
                ],
                grid: [
                  { label: "Option shopping", value: "Derniers achats Jing'an / Xintiandi / Nanjing Road" },
                  { label: "Option resto", value: "Déjeuner tardif dans un café de Wukang Road" },
                  { label: "Option musée", value: "UCCA Edge ou Power Station of Art si pas encore fait" },
                  { label: "Option sieste", value: "Recharge avant le vol de nuit" }
                ],
                transport: { icon: "🚇", text: "Selon destination choisie" },
                tip: "Penser à préparer les bagages en début d'après-midi. Départ pour Pudong prévu vers 22h00 — prévoir dîner léger avant."
              }
            ]
          }
        ]
      }
    },
    {
      id: "j10",
      navLabel: "Dim. 24 mai",
      content: {
        title: "Dimanche 24 mai – Départ Shanghai → Retour à Paris",
        subtitle: "Trajet Pudong · Départ de Pudong · Escale à Athènes",
        badges: [],
        timeline: [
          { time: "22h00",     color: "orange", content: "Départ de chez LM" },
          { time: "1h10",      color: "orange", content: "Décollage Pudong International Airport (PVG) – vol HO1657 Juneyao Airlines" },
          { time: "7h45",      color: "orange", content: "Arrivée Athènes – escale 2h55" },
          { time: "10h40",     color: "orange", content: "Décollage Athènes – vol A3616 Aegean Airlines" },
          { time: "13h10",     color: "gray",   content: "Atterrissage Roissy CDG" }
        ],
        slots: [
          {
            type: "transit",
            icon: "✈️",
            time: "Samedi soir – Dimanche",
            name: "Transports Shanghai → Paris",
            activities: [
              {
                name: "Didi LM → Pudong International Airport (PVG)",
                badges: [],
                grid: [
                  { label: "Départ", value: "22h (dimanche 24 mai)" },
                  { label: "Arrivée", value: "23h00" },
                ],
                tip: "🚗 Prévoir ~1h depuis Jing'an selon trafic, partir au plus tard 22h00 pour un départ 1h10"
              },
              {
                name: "Shanghai Pudong (PVG) → Athènes",
                badges: [],
                grid: [
                  { label: "Départ", value: "1h10 (dimanche 24 mai)" },
                  { label: "Arrivée", value: "7h45 Athènes" },
                  { label: "Compagnie", value: "Juneyao Airlines" },
                  { label: "Vol", value: "HO1657" }
                ],
                tip: "✈️ Embarquement Pudong Terminal – vérifier terminal exact sur billet Juneyao"
              },
              {
                name: "Athènes → Roissy CDG",
                badges: [],
                grid: [
                  { label: "Départ", value: "10h40 Athènes (escale 2h55)" },
                  { label: "Arrivée", value: "13h10 Roissy CDG" },
                  { label: "Compagnie", value: "Aegean Airlines" },
                  { label: "Vol", value: "A3616" }
                ],
                tip: "✈️ Correspondance à Athènes – 2h55 d'escale, suffisant pour changer de terminal si nécessaire"
              }
            ]
          }
        ]
      }
    },
    {
        id: "infos",
        navLabel: "Infos pratiques",
        content: {
          title: "Informations pratiques",
          subtitle: "Météo, apps, accessibilité, budget, activités écartées",
          elements : [
            {
              title: "🌦 Météo mi-mai à Shanghai",
              items: [
                  "Températures : 18–27°C, humidité montante (70–80%), orages possibles",
                  "Prévoir : vêtements légers + couche légère le soir, parapluie pliant compact",
                  "Crème solaire indispensable – UV élevés même par temps nuageux",
                  "Alternatives indoor si pluie : Natural History Museum (J2), Shanghai Museum (J2), 1000 Trees (J1), iapm Mall"
              ]
            },
            {
              title: "📅 Jours fériés & événements 19–22 mai 2026",
              items: [
                  "Aucun jour férié national chinois sur cette période",
                  "Légère affluence de mi-semaine standard",
                  "Lundi 18 mai = veille de votre arrivée → les musées rouvrent bien le mardi 19"
              ]
            },
            {
              title: "📱 Applications à télécharger AVANT le départ",
              items: [
                  "<strong>VPN</strong> : ExpressVPN ou NordVPN — à installer en France. Google Maps, Instagram, WhatsApp sont bloqués en Chine.",
                  "<strong>Cartes</strong> : Apple Maps ou Baidu Maps (fonctionnent sans VPN)",
                  "<strong>Transport</strong> : Shanghai Metro App, <strong>Didi</strong> (équivalent Uber, fonctionne avec carte étrangère)",
                  "<strong>Paiement</strong> : <strong>Alipay International</strong> (accepte Visa/Mastercard depuis 2024) · WeChat Pay possible avec carte étrangère",
                  "<strong>Traduction</strong> : Google Translate en mode photo (menus) — nécessite VPN",
                  "<strong>Réservations</strong> : <strong>Trip.com</strong> (tickets, transports, restaurants)",
                  "<strong>Trains</strong> : Trip.com ou 12306.cn pour Shanghai ↔ Suzhou (J4)",
              ]
            },
            {
              title: "🗣 Accessibilité & langues",
              items: [
                  "Métro de Shanghai : totalement bilingue CN/EN, très facile sans mandarin",
                  "Panneaux EN : Bund, Nanjing Road, Jing'an Temple, Natural History Museum, Shanghai Museum, Xintiandi",
                  "Panneaux CN seulement : quelques salles Yu Garden, Museum of Public Security, Tongli",
                  "Tip : photographier les adresses en chinois sur Google Maps avant de partir — à montrer aux chauffeurs Didi",
              ]
            },
            {
              title: "🚫 Activités écartées",
              items: [
                  "<strong>Zoo de Shanghai</strong> : trop éloigné",
                  "<strong>Museum of Public Security</strong> : peu de contenu EN",
                  "<strong>Wukang Road / Anfu Road matin</strong> : déplacé au soir J3"
              ]
            }
        ]
      }
    }
];
