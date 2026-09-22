/**
 * Brand identity — the ONLY place the product name, domain, and copy live.
 * `grep -ri "huddle" apps packages --include="*.ts*"` outside this file
 * (and content that legitimately quotes copy from here) should turn up
 * nothing hardcoded. Rename the product by editing this file alone.
 *
 * Source: CLAUDE_CODE_HANDOFF.md top-of-file brand note + §section 0.
 */

export const brand = {
  name: "Huddle",
  legalWorkingName: "Huddle (working name)",
  domain: "joinahuddle.com",
  shortLinkBase: "joinahuddle.com/j",

  tagline: "The game is better with your people.",
  secondaryTagline: "Watch together. From anywhere.",
  signOff: "Same game. Different zip codes. Still together.",

  descriptor: "the digital couch for live events",

  northStar:
    "Does this make watching a game remotely with my friends feel more like sitting on the same couch?",

  copyBlocks: {
    home: {
      title: "The game is better with your people.",
    },
    invite: {
      readyHeadline: (groupName: string) => `${groupName.toUpperCase()} IS READY!`,
      liveHeadline: (groupName: string) => `${groupName} is Live.`,
      subhead: "Invite your crew. Same game. Different zip codes. Still together.",
    },
    guestEntry: {
      invitedBy: (inviterName: string, groupName: string) =>
        `${inviterName} invited you to ${groupName}`,
    },
    sync: {
      title: "Sync Your Game",
      subhead: "We'll keep reactions aligned with your broadcast.",
    },
    bets: {
      disclaimer: "We don't take wagers. Track your bets from your favorite sportsbook.",
    },
  },

  footerTagline: "SPORTS · SHOWS · EVENTS · WITH YOUR PEOPLE",
} as const;

export type Brand = typeof brand;
