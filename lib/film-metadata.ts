export const films = [
 {key:'avatar-2009',title:'Avatar',year:2009,wiki:'Avatar (2009 film)',pattern:/^avatar[. _([]/i},
 {key:'avatar-way-of-water',title:'Avatar: The Way of Water',year:2022,wiki:'Avatar: The Way of Water',pattern:/avatar.*way.*water/i},
 {key:'assassins-1995',title:'Assassins',year:1995,wiki:'Assassins (1995 film)',pattern:/^assassins[. _([]/i},
 {key:'black-hawk-down',title:'Black Hawk Down',year:2001,wiki:'Black Hawk Down (film)',pattern:/black.*hawk.*down/i},
 {key:'mission-impossible-1996',title:'Mission: Impossible',year:1996,wiki:'Mission: Impossible (film)',pattern:/mission.*impossible/i},
 {key:'mission-impossible-2',title:'Mission: Impossible 2',year:2000,wiki:'Mission: Impossible 2',pattern:/mission.*impossible/i},
 {key:'mission-impossible-3',title:'Mission: Impossible III',year:2006,wiki:'Mission: Impossible III',pattern:/mission.*impossible/i},
 {key:'ghost-protocol',title:'Mission: Impossible – Ghost Protocol',year:2011,wiki:'Mission: Impossible – Ghost Protocol',pattern:/mission.*ghost.*protocol/i},
 {key:'rogue-nation',title:'Mission: Impossible – Rogue Nation',year:2015,wiki:'Mission: Impossible – Rogue Nation',pattern:/mission.*rogue.*nation/i},
 {key:'fallout',title:'Mission: Impossible – Fallout',year:2018,wiki:'Mission: Impossible – Fallout',pattern:/mission.*fallout/i},
 {key:'dead-reckoning',title:'Mission: Impossible – Dead Reckoning Part One',year:2023,wiki:'Mission: Impossible – Dead Reckoning Part One',pattern:/mission.*dead.*reckon/i},
 {key:'the-dark-knight',title:'The Dark Knight',year:2008,wiki:'The Dark Knight',pattern:/the[. _-]+dark[. _-]+knight(?![. _-]+rises)/i},
 {key:'superman-2025',title:'Superman',year:2025,wiki:'Superman (2025 film)',pattern:/^superman[. _([]/i},
 {key:'mugen-train',title:'Demon Slayer: Mugen Train',year:2020,wiki:'Demon Slayer: Kimetsu no Yaiba – The Movie: Mugen Train',pattern:/demon.*mugen.*train/i},
 {key:'infinity-castle',title:'Demon Slayer: Infinity Castle',year:2025,wiki:'Demon Slayer: Kimetsu no Yaiba – The Movie: Infinity Castle',pattern:/demon.*infinity.*castle/i},
 {key:'john-wick-2',title:'John Wick: Chapter 2',year:2017,wiki:'John Wick: Chapter 2',pattern:/john.*wick.*chapter[. _-]+2\b/i},
 {key:'john-wick-3',title:'John Wick: Chapter 3 – Parabellum',year:2019,wiki:'John Wick: Chapter 3 – Parabellum',pattern:/john.*wick.*chapter[. _-]+3\b/i},
 {key:'enter-the-dragon',title:'Enter the Dragon',year:1973,wiki:'Enter the Dragon',pattern:/enter[. _-]+the[. _-]+dragon/i},
 {key:'salt-2010',title:'Salt',year:2010,wiki:'Salt (2010 film)',pattern:/^salt[. _([]/i},
 {key:'quantum-of-solace',title:'Quantum of Solace',year:2008,wiki:'Quantum of Solace',pattern:/quantum.*solace/i},
 {key:'the-lone-ranger',title:'The Lone Ranger',year:2013,wiki:'The Lone Ranger (2013 film)',pattern:/the.*lone.*ranger/i},
 {key:'oceans-eleven',title:"Ocean's Eleven",year:2001,wiki:"Ocean's Eleven (2001 film)",pattern:/ocean.?s.*eleven/i},
 {key:'hunt-2022',title:'Hunt',year:2022,wiki:'Hunt (2022 film)',pattern:/^hunt[. _([]/i},
];
export function identifyFilm(filename:string,year:number|null){const clean=filename.replace(/^(?:copy of\s+)+/i,'');const matches=films.filter(f=>(year===null||f.year===year)&&f.pattern.test(clean));return matches.length===1?matches[0]:null;}
export function formatFileSize(bytes:number){if(!Number.isFinite(bytes)||bytes<0)return 'Unknown';if(bytes>=1073741824)return (bytes/1073741824).toFixed(2)+' GiB';if(bytes>=1048576)return (bytes/1048576).toFixed(2)+' MiB';if(bytes>=1024)return (bytes/1024).toFixed(2)+' KiB';return bytes+' B';}
export const reviewedPosterUrls:Record<string,string>={
 'avatar-2009':'https://upload.wikimedia.org/wikipedia/en/d/d6/Avatar_%282009_film%29_poster.jpg',
 'avatar-way-of-water':'https://upload.wikimedia.org/wikipedia/en/5/54/Avatar_The_Way_of_Water_poster.jpg',
 'assassins-1995':'https://image.tmdb.org/t/p/w780/wPmZYnaQpxwoHmwNwVhZ2IY0UbF.jpg',
 'black-hawk-down':'https://upload.wikimedia.org/wikipedia/en/0/0c/Black_hawk_down_ver1.jpg',
};
