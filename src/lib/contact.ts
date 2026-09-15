// THE ONE PLACE THE BUSINESS'S CONTACT DETAILS ARE WRITTEN DOWN.
//
// WHAT WAS WRONG
// The privacy policy and the three terms pages each carried their own copy of
// the contact address. Two copies of a fact are two facts, and the day one is
// changed and the other is not, the published documents disagree about how to
// reach the business - on exactly the pages a person visits BECAUSE they could
// not reach it another way.
//
// Google Play may write to this address, and a person has the right to ask for
// their data to be deleted through it. It has to be an address somebody reads.
//
// SANA, 15 SEPTEMBER 2026: "Now add these emails in the Privacy policies and
// terms and conditions."
//
// WHY THIS IS NOW A TAKAL ADDRESS AND NOT A PERSONAL GMAIL.
// A legal document that gives a personal Gmail tells a reader the business is
// one person's side project. These two are Takal's own addresses on Takal's own
// domain, and both are forwarded into that same Gmail - so the same person
// still reads every word, and nothing is missed.
//
// It also means the address can be handed to somebody else later without
// reprinting the privacy policy, the terms, the app stores and the website.
//
// IF THE FORWARDING EVER BREAKS, these addresses stop arriving and the Gmail
// itself keeps working. The forwarding is set up in Cloudflare, under
// Email Routing for takalapp.com.

/** THE ADDRESS FOR ANYTHING THAT NEEDS AN ANSWER: a data request, an account
 *  deletion, a complaint, Google Play, Apple. This is the one on the privacy
 *  policy and the terms. */
export const CONTACT_EMAIL = "support@takalapp.com";

/** GENERAL ENQUIRIES. Shown beside the one above, never instead of it - a
 *  deletion request must have one obvious place to go, not two. */
export const CONTACT_EMAIL_GENERAL = "info@takalapp.com";

export const BUSINESS_NAME = "Takal";

export const BUSINESS_LOCATION = "Swat, Khyber Pakhtunkhwa, Pakistan";

/**
 * THE HELP NUMBER PRINTED ON A DELIVERY SLIP.
 *
 * Sana's rule (docs/PRIVACY-AND-CONTACT-RULES.md, section 3): a customer never
 * gets a shop's number and a shop never gets a customer's - both go through
 * Takal. So the slip carries Takal's own way of being reached.
 *
 * IT IS DELIBERATELY EMPTY UNTIL SANA GIVES A REAL NUMBER. The approved
 * mock-up printed "0300 000 0000" as a placeholder, and a placeholder number
 * on a real slip is worse than no number at all: somebody rings it, gets
 * nothing, and stops trusting the slip. The slip leaves the line out entirely
 * while this is blank, and prints it the moment a number is put here.
 */
export const CONTACT_PHONE = "";
