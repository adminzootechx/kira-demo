/**
 * The "?" hints on figures and cards. One place, so the wording matches the
 * client document that explains how the dashboard calculates its numbers
 * ("LUSTRE - How the dashboard calculates its numbers"). KpiCard and CardHeader
 * look their label or title up here when no `help` is passed.
 *
 * Keep each entry to what the figure means and how it is worked out, in plain
 * words. When a calculation changes in lib/analytics, change its entry here.
 */

export const METRIC_HELP: Record<string, string> = {
  // Home and Customers
  "Sales, last 12 months":
    "Everything invoiced in the 365 days up to the date of the last sale in the data, compared with the 365 days before that. The percentage is the change between the two.",
  "Active customers":
    "Customers who placed an order in the last 180 days. The total beneath is everyone in your book, including those who have gone quiet.",
  "At risk of leaving":
    "Customers who still ordered in the last 180 days but whose risk score is 60 or more out of 100. The risk score adds up four warning signs: being late against their own usual gap between orders (up to 45 points), spending less than before (30), ordering rarely (15) and slow payment (10). The dollar figure is what they would spend in a year at their current pace.",
  "Due to reorder now":
    "Customers whose own pattern says an order is due: they are inside their usual reorder window, or will enter it within 7 days. The window comes from each customer's own typical gap between orders.",

  // Targets
  "Sold so far":
    "Sales this year credited to the salesperson recorded on each sale, against the target set in Administration. The line beneath shows what the customers they handle today have bought, which can differ when clients were reassigned.",
  "Ahead of pace":
    "What has been sold, minus what should have been sold by the date the data runs to. 'Should have sold' is the target times the share of the year gone, using last year's monthly pattern once a full year of data exists, otherwise a straight line.",
  "Behind pace":
    "What should have been sold by the date the data runs to, minus what has been sold. 'Should have sold' is the target times the share of the year gone, using last year's monthly pattern once a full year of data exists, otherwise a straight line.",
  "Expected by year end":
    "Sold so far divided by the share of the year already gone: where you finish if the rest of the year follows the same pattern. It is a projection, not a promise.",
  "Still to sell":
    "The target minus what has been sold. The monthly figure spreads it over the months left, counting the current one.",
  "Progress through the year":
    "The bar is what has been sold. The marker is where last year's sales pattern says you should be by the date the data runs to.",
  "Ways to close the gap":
    "Each line is the money at stake times the chance the customer keeps buying, so these are cautious estimates. They overlap, so do not add them up as a promise.",
  "Sales by month":
    "Sales in each month of this year, compared with an even twelfth of the target.",

  // Things to check
  "Things to check":
    "Accounts flagged right now: customers past their usual reorder time, plus customers whose last 12 months are down 40% or more on the 12 before (counted only if they sold at least $5,000 then).",
  "Past their usual time":
    "Customers whose time since their last order is longer than their own usual longest gap between orders.",
  "Sales at stake":
    "For customers past their usual time, their sales in the last 12 months. For customers who dropped sharply, the amount they fell by. Added together.",
  "Accounts to look at":
    "The flagged accounts, largest amount at stake first.",

  // Home lists
  "Reorder calls":
    "Customers due now, or past their usual time, with the biggest usual order first. Lapsed customers are not here; they are on the Win-back list on My day.",
  "May be drifting away":
    "Customers who still ordered in the last 180 days, have a risk score of 50 or more and are spending less than in the 12 months before. Biggest drop in dollars first.",

  // Prices and Stock
  "Price per carat":
    "Total sales divided by total carats over the period, across the whole mix of stones. A richer mix of large or fine stones raises it without any price change.",
  "Average discount":
    "The average discount off the natural Rapaport price list across the sales in the period.",
  "Average invoice":
    "Sales divided by the number of orders in the period.",
  "Specifications priced":
    "Kinds of stone (shape, size, colour and clarity together) with 30 or more comparable sales, enough to say what a normal price is.",
  "Stones sold": "Stones invoiced in the period. The line beneath is the number of orders they came in.",
  "Carats sold": "Total carat weight invoiced in the period.",
  Specifications:
    "Distinct combinations of shape, size, colour and clarity that sold in the period.",
  "How our prices compare":
    "What each type of stone sold for recently against its own price across all our sales. A big gap either way is worth a look.",
  "How much discount we give":
    "How many sales, and how much invoiced value, fall into each discount band.",
  "Who holds price best":
    "How the discount each account manager gives compares with what the same stones sold for across all our sales. Giving away more than the benchmark counts as leaking price.",
  "How each type of stone is selling":
    "Each row is one kind of stone. It shows what it earned, how fast it sells, and whether it risks sitting unsold.",
  "What is in demand, by shape and size":
    "A grid of shape against size. Darker squares sold better than the average square.",
  "How long stock has been sitting":
    "Stock grouped into bands by how long we have held it. The longer something sits, the more likely it needs a discount to move.",
  "How fast each type of stone sells":
    "Stones sold per 30 days for each type. Dividing the stock held by this gives the expected days to sell.",

  // Team and leaderboard
  Salespeople: "Salespeople with at least one sale in the period.",
  "Sales booked":
    "Everything invoiced in the period, with the change against the same dates last year.",
  "Customers who bought": "Distinct customers with at least one order in the period.",
  "Brokered revenue":
    "The share of sales that came through brokers, using the largest brokers listed.",
  "How each salesperson is doing":
    "More than sales totals: whether they keep their customers, win back the ones who drift, and hold price instead of discounting.",
  "Score breakdown":
    "The leaderboard score is 60% sales, 25% growth and 15% customers still ordering on time. Each is scaled between the lowest and highest on the team, so the score shows standing against colleagues, not an absolute grade. Diamond tier is a score of 50 or more, Gold is 40 or more.",
  "Team leaderboard":
    "Salespeople ranked by the score described under Score breakdown. A rep sees only their own score and sales.",
  "Your next spot":
    "The salesperson one place above you, shown without a name, and the sales needed to pass them.",
  "Strengths and weak spots":
    "Where each account manager scores high and low on retention, repeat business, price held and how concentrated their customers are.",

  // Customers concentration
  "How much rides on our biggest customers":
    "The share of this period's revenue held by the single largest customer, the top 5 and the top 10. The higher the share, the more a loss would hurt.",
  "How much rides on each broker":
    "The share of revenue routed through each broker network.",
  "How much rides on each country":
    "The share of sales each country's customers account for.",
};

/** Looks a label or card title up, ignoring a trailing count such as "At risk of leaving (166)". */
export function helpFor(title: string): string | undefined {
  return METRIC_HELP[title] ?? METRIC_HELP[title.replace(/\s*\([^)]*\)\s*$/, "")];
}
