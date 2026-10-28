'use client';
import {X} from 'lucide-react';
export type ActiveFilter={id:string;label:string;remove:()=>void};
export default function ActiveFilters({filters,clear}:{filters:ActiveFilter[];clear:()=>void}){if(!filters.length)return null;return <div className="active-filter-bar"><span>Active filters</span><div>{filters.map(filter=><button key={filter.id} onClick={filter.remove} aria-label={'Remove filter: '+filter.label}>{filter.label}<X size={15}/></button>)}</div><button className="active-filter-clear" onClick={clear}>Clear all</button></div>;}
