import {turnstileConfig} from '../../../lib/turnstile';
export function GET(){return Response.json(turnstileConfig(),{headers:{'Cache-Control':'no-store'}});}
