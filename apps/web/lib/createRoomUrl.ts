/**
 * Builds the /create URL for a real event, carrying its details along as
 * query params so the room created there is tied to it (see
 * app/api/rooms/route.ts). Shared by Home's "Tonight" card and Explore's
 * game list — both just need a game-shaped object with an id and the
 * usual home/away fields; `league`/`title` are optional since Home's
 * NFL-only schedule doesn't set them (see api/schedule/route.ts vs.
 * api/games/route.ts).
 */
export interface CreatableGame {
  id: string;
  league?: string;
  title?: string;
  homeAbbr: string;
  awayAbbr: string;
  homeName: string;
  awayName: string;
  dateISO: string;
}

export function createRoomUrlForGame(game: CreatableGame): string {
  const params = new URLSearchParams({
    providerEventId: game.id,
    homeAbbr: game.homeAbbr,
    awayAbbr: game.awayAbbr,
    homeName: game.homeName,
    awayName: game.awayName,
    startTime: game.dateISO,
  });
  if (game.league) params.set("league", game.league);
  if (game.title) params.set("title", game.title);
  return `/create?${params.toString()}`;
}
