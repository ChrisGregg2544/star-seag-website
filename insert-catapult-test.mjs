/**
 * insert-catapult-test.mjs
 * Inserts real P7 Catapult Papers Test 1 questions into Supabase
 * for validator testing. source = 'catapult_test', validated = false.
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=eyJ... node insert-catapult-test.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_KEY) { console.error('Missing SUPABASE_SERVICE_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const PASSAGE_WATCHER = `The Watcher

1. It had started innocently enough. A rustle in the bushes, a glimpse of something
2. moving in the shadows. But as the days passed, Charlotte had become increasingly
3. convinced that she was being watched.
4. At first, she had dismissed it as her imagination. But then she had found the trail of
5. crumbs leading up to her bedroom door one afternoon. The day after this, she was
6. certain she could hear the faint sound of steps following at a distance behind her
7. while walking through the gardens. She dared not turn to look.
8. Charlotte had tried to brush it off, but the feeling of unease had persisted. And then,
9. one night, she had awoken to the sound of the same steps outside her door.
10. Heart pounding, Charlotte had leapt out of bed and rushed to the door, flinging it
11. open. But there was no one there, only a child's toy made of cloth and torn at the
12. seams. She left it alone and returned to the safety of her bed.
13. It was then that she knew for certain that something was amiss at Thornfield. She
14. had shared her fears with Mrs Fairfax, the kind and motherly housekeeper, but even
15. she seemed hesitant to believe her.
16. And so, Charlotte had taken it upon herself to investigate. She had spent long hours
17. wandering through the halls of Thornfield, listening for any sounds that seemed out
18. of place, and peeking around corners for any sign of the mysterious watcher.
20. But so far, her efforts had been in vain. The watcher remained out of reach, and
21. Charlotte remained haunted by the fear that she was in danger. She knew she had
22. to be careful, for if the watcher discovered her investigation, the consequences could
23. be dreadful.
24. As she walked through the halls of Thornfield, Charlotte decided to redouble her
25. efforts. She would not rest until she had uncovered the truth behind the mysterious
26. watcher, and put an end to whatever nefarious plot they were hatching. For the sake
27. of Thornfield and all its inhabitants, she would not give up.
28. Days turned into weeks, and still, Charlotte's search for the watcher continued.
29. The weight of her secret pressed down on her like a lead blanket, and she found
30. herself constantly looking over her shoulder, waiting for the watcher to pounce.
31. Mrs Fairfax had grown increasingly concerned about Charlotte's behaviour, but
32. Charlotte could not bring herself to confide in her further. She could not bear the
33. thought of burdening the kind housekeeper with her concerns, for fear of bringing
34. her into danger.
35. And then, one fateful night, Charlotte's worst fears were realised. As she lay in bed,
36. unable to sleep, she heard the unmistakable sound of those steps outside her door.
37. She lay frozen in terror as a shadow appeared below it.
38. With a strength she did not know she possessed, Charlotte sprang out of bed and
39. hurled herself against the door. The figure on the other side darted away, then
40. Charlotte bolted down the hallway.
41. She did not stop until she reached the safety of Mrs Fairfax's room, where she
42. burst in, gasping for breath. Mrs Fairfax listened to Charlotte's story with a look of
43. grave concern on her face, and together, they hatched a plan to catch the watcher
44. once and for all.
45. The plan was simple but risky. Charlotte would draw the watcher out into the
46. gardens, pretending to be oblivious to their presence. Meanwhile, Mrs Fairfax and
47. the rest of the staff would be lying in wait, ready to apprehend the watcher as soon
48. as they made their move.
49. Charlotte felt a thrill of fear and excitement as she slipped out into the gardens that
50. night. She wandered slowly through the winding paths, her heart racing, pretending
51. to admire the moonlit flowers. And then, just as she had hoped, she heard a rustling
52. in the bushes.
53. She turned to face the watcher. She was stunned. And amused. She had not
54. looked into their eyes for more than a few seconds before noticing that same
55. tattered toy, which she now knew she could confidently remove from the watcher's
56. mouth. It was only then that Charlotte was startled again: her name was stitched on
57. the toy's back...`;

const QUESTIONS = [

  // ── PUNCTUATION Q1-5 ───────────────────────────────────────────────────────
  {
    subject: 'English', topic: 'punctuation', question_type: 'Punctuation',
    passage: "It's all in a days work / for firefighters to face danger / and protect / others' lives.",
    question_text: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
    options: { A: "It's all in a days work", B: "for firefighters to face danger", C: "and protect", D: "others' lives.", N: "No mistake" },
    correct_answer: 'A',
    explanation: "The work belongs to the day. A possessive apostrophe is needed: day's work. Compare to others' (lives belong to others) which is correct."
  },
  {
    subject: 'English', topic: 'punctuation', question_type: 'Punctuation',
    passage: "Frank was often warned / by his Mum, dad and brother / to not cycle / near the road.",
    question_text: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
    options: { A: "Frank was often warned", B: "by his Mum, dad and brother", C: "to not cycle", D: "near the road.", N: "No mistake" },
    correct_answer: 'B',
    explanation: "Mum is not a proper noun here. Names like Mum and Dad are only capitalised when used as their actual name (I told Mum / I told my mum)."
  },
  {
    subject: 'English', topic: 'punctuation', question_type: 'Punctuation',
    passage: "It wasn't long / before Gabriel discovered / that his friends / weren't there.",
    question_text: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
    options: { A: "It wasn't long", B: "before Gabriel discovered", C: "that his friends", D: "weren't there.", N: "No mistake" },
    correct_answer: 'N',
    explanation: "Both apostrophes are contractions used correctly: wasn't = was not, weren't = were not. The apostrophe replaces the letter o in each case."
  },
  {
    subject: 'English', topic: 'punctuation', question_type: 'Punctuation',
    passage: "'If I could make any day illegal' , fumed Brody, / 'I'd ban / Mondays!'",
    question_text: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
    options: { A: "'If I could make any day illegal'", B: ", fumed Brody,", C: "'I'd ban", D: "Mondays!'", N: "No mistake" },
    correct_answer: 'B',
    explanation: "The comma must come before the closing speech mark, not after it. Closing speech marks must always be preceded by a punctuation mark."
  },
  {
    subject: 'English', topic: 'punctuation', question_type: 'Punctuation',
    passage: "Christmas trees some people say, / shouldn't be put up until / the beginning of / December at the very earliest.",
    question_text: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
    options: { A: "Christmas trees some people say,", B: "shouldn't be put up until", C: "the beginning of", D: "December at the very earliest.", N: "No mistake" },
    correct_answer: 'A',
    explanation: "The phrase 'some people say' is a dependent clause inserted into the sentence. It needs a comma before it, after 'Christmas trees'."
  },

  // ── GRAMMAR Q6-10 ─────────────────────────────────────────────────────────
  {
    subject: 'English', topic: 'grammar', question_type: 'Grammar',
    question_text: "Whenever Lauren and Jane _____, they become difficult people to be around!",
    options: { A: "loose", B: "loosed", C: "lose", D: "lost", E: "had lost" },
    correct_answer: 'C',
    explanation: "The sentence is in the present tense. Loose means 'set free'. Lose is the correct present-tense verb here."
  },
  {
    subject: 'English', topic: 'grammar', question_type: 'Grammar',
    question_text: "A huge meteor came plummeting _____ the planet at a phenomenal speed.",
    options: { A: "around", B: "above", C: "beneath", D: "towards", E: "beside" },
    correct_answer: 'D',
    explanation: "Towards is the most sensible preposition here: plummeting tells us the downward direction towards the planet."
  },
  {
    subject: 'English', topic: 'grammar', question_type: 'Grammar',
    question_text: "Janet had never _____ with this particular choir before.",
    options: { A: "sing", B: "singing", C: "song", D: "sang", E: "sung" },
    correct_answer: 'E',
    explanation: "The key word is had. When a verb is preceded by had, it becomes a past participle. Compare: Janet never sang / Janet had never sung."
  },
  {
    subject: 'English', topic: 'grammar', question_type: 'Grammar',
    question_text: "_____ my protests, Mum made me tidy my room.",
    options: { A: "During", B: "Despite", C: "After", D: "Because", E: "Due" },
    correct_answer: 'B',
    explanation: "Despite works the same way as 'Even though I protested…'. It introduces a contrast between the protest and the outcome."
  },
  {
    subject: 'English', topic: 'grammar', question_type: 'Grammar',
    question_text: "_____ it wasn't our fault, we all had to take the blame for what someone in the other class did.",
    options: { A: "Except", B: "Although", C: "Since", D: "Until", E: "As" },
    correct_answer: 'B',
    explanation: "Although shows a contrast: the children suffered a consequence even though it wasn't their fault."
  },

  // ── SPELLING Q11-15 ───────────────────────────────────────────────────────
  {
    subject: 'English', topic: 'spelling', question_type: 'Spelling',
    question_text: "Find the section with the spelling mistake. If there is no mistake, mark N.",
    options: { A: "Sam would occassionally", B: "take a trip to the forest", C: "to observe", D: "the wildlife.", N: "No mistake" },
    correct_answer: 'A',
    explanation: "The spelling should be occasionally (one s). If it had a double s the -assion would sound like passion, but here there is a softer z sound."
  },
  {
    subject: 'English', topic: 'spelling', question_type: 'Spelling',
    question_text: "Find the section with the spelling mistake. If there is no mistake, mark N.",
    options: { A: "My least favourite types of", B: "punctuation are commas", C: "and", D: "apostrophies.", N: "No mistake" },
    correct_answer: 'D',
    explanation: "The spelling should be apostrophes. The only other common word ending like apostrophe is catastrophe."
  },
  {
    subject: 'English', topic: 'spelling', question_type: 'Spelling',
    question_text: "Find the section with the spelling mistake. If there is no mistake, mark N.",
    options: { A: "We agreed that it was unusual", B: "to hear such a racket", C: "come from", D: "the libary.", N: "No mistake" },
    correct_answer: 'D',
    explanation: "The spelling should be library. It is often misspelled because we say the word quickly. Exaggerate the 'RAR' when spelling it."
  },
  {
    subject: 'English', topic: 'spelling', question_type: 'Spelling',
    question_text: "Find the section with the spelling mistake. If there is no mistake, mark N.",
    options: { A: "Today's attendence", B: "is an enormous improvement", C: "upon last week's", D: "number.", N: "No mistake" },
    correct_answer: 'A',
    explanation: "The spelling should be attendance. There is no easy rule for -ance vs -ence; find a memorable way such as the word dance."
  },
  {
    subject: 'English', topic: 'spelling', question_type: 'Spelling',
    question_text: "Find the section with the spelling mistake. If there is no mistake, mark N.",
    options: { A: "Waiting patiently by the side of the road,", B: "they had no idea that the weather", C: "would suddenly change", D: "for the worse.", N: "No mistake" },
    correct_answer: 'N',
    explanation: "There are no spelling mistakes. Patiently is often misspelled; the opening syllable sounds a little like 'pay'."
  },

  // ── COMPREHENSION MC Q16-22 ───────────────────────────────────────────────
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "How does the watcher's behaviour affect the mood of the passage?",
    options: { A: "It adds a romantic and mysterious element to the story.", B: "It adds a humorous and light-hearted element to the story.", C: "It adds a tense and mysterious element to the story.", D: "It adds an adventurous and playful element to the story.", E: "It adds a colourful and spectacular element to the story." },
    correct_answer: 'C',
    explanation: "The watcher moves in shadows (line 2), follows at a distance (lines 6-7), approaches her room (lines 8-9). Not seeing it adds mystery; the constant threat adds tension."
  },
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "Look at lines 13-15. What was Mrs Fairfax's reaction when Charlotte first shared her fears with her?",
    options: { A: "She believed Charlotte immediately.", B: "She didn't believe Charlotte at all.", C: "She was reluctant to believe Charlotte.", D: "She was angry at Charlotte for investigating.", E: "She felt guilty because she knew who the watcher was." },
    correct_answer: 'C',
    explanation: "See line 15: she seemed hesitant to believe her. Mrs Fairfax is hesitating; she does not immediately believe Charlotte but does wonder."
  },
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "What part of speech is the word 'motherly' (line 14)?",
    options: { A: "adjective", B: "noun", C: "verb", D: "adverb", E: "preposition" },
    correct_answer: 'A',
    explanation: "Motherly is describing the noun housekeeper. Adjectives are words that describe nouns."
  },
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "'Charlotte would draw the watcher out into the gardens, pretending to be oblivious to their presence.' (lines 45-46). What does this tell us about the plan?",
    options: { A: "Charlotte would write an invitation to the watcher to meet her.", B: "Charlotte would catch the watcher and drag them to the gardens.", C: "Charlotte would watch the watcher from a distance.", D: "Charlotte would stand in the gardens and challenge the watcher to appear.", E: "Charlotte would act as if she wasn't concerned about the watcher." },
    correct_answer: 'E',
    explanation: "Lines 49-51 describe Charlotte pretending to admire the flowers (line 50). She is acting as if she is not concerned about the watcher."
  },
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "Which of these words from the passage is closest in meaning to 'wicked'?",
    options: { A: "amiss (line 13)", B: "vain (line 20)", C: "nefarious (line 26)", D: "confide (line 32)", E: "grave (line 43)" },
    correct_answer: 'C',
    explanation: "Nefarious means wicked. Amiss means missing/not right; vain means fruitless; confide means entrust; grave means serious."
  },
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "Why does Charlotte feel 'a thrill of fear and excitement' (line 49) towards the end of the passage?",
    options: { A: "She knows the identity of the watcher and can't wait to meet them.", B: "The plan, although risky, is adventurous.", C: "She loves acting.", D: "She gets to admire the flowers.", E: "She feels completely confident because the staff are nearby." },
    correct_answer: 'B',
    explanation: "Option A is false; there is no evidence Charlotte enjoys acting (C); option D is not the reason; option E is wrong as she does not feel completely confident."
  },
  {
    subject: 'English', topic: 'comprehension_mc', question_type: 'Comprehension_MC',
    passage: PASSAGE_WATCHER,
    question_text: "What does Charlotte discover about the watcher in lines 53-57?",
    options: { A: "The watcher is a harmless toy-maker.", B: "The watcher is a member of the staff.", C: "The watcher is a harmless animal.", D: "The watcher is Mrs Fairfax.", E: "There was no watcher." },
    correct_answer: 'C',
    explanation: "Lines 54-56: Charlotte removes the toy from the watcher's mouth. She is confident doing so — it is presumably a dog that has been following her."
  },

  // ── COMPREHENSION FR Q23-28 ───────────────────────────────────────────────
  {
    subject: 'English', topic: 'comprehension_fr', question_type: 'Comprehension_FR',
    passage: PASSAGE_WATCHER,
    question_text: "Look at lines 4-9. What thing did Charlotte find to convince her that the watcher was not part of her imagination?",
    options: {},
    correct_answer: 'crumbs',
    explanation: "The answer is on lines 4-5. Accept longer answers but it must include crumbs."
  },
  {
    subject: 'English', topic: 'comprehension_fr', question_type: 'Comprehension_FR',
    passage: PASSAGE_WATCHER,
    question_text: "What was the name of the house at which Charlotte was staying?",
    options: {},
    correct_answer: 'Thornfield',
    explanation: "See lines 13, 17, 23 and 26."
  },
  {
    subject: 'English', topic: 'comprehension_fr', question_type: 'Comprehension_FR',
    passage: PASSAGE_WATCHER,
    question_text: "Which one word in lines 8-12 means the same as 'continued' or 'lasted'?",
    options: {},
    correct_answer: 'persisted',
    explanation: "Swap the word in the question with a word in the passage to see if it sounds correct. We must find another past tense verb."
  },
  {
    subject: 'English', topic: 'comprehension_fr', question_type: 'Comprehension_FR',
    passage: PASSAGE_WATCHER,
    question_text: "Which line from lines 27-33 contains a simile? Write the number of the line.",
    options: {},
    correct_answer: '29',
    explanation: "The weight of her secret pressed down on her like a lead blanket (line 29). Similes compare things using as or like."
  },
  {
    subject: 'English', topic: 'comprehension_fr', question_type: 'Comprehension_FR',
    passage: PASSAGE_WATCHER,
    question_text: "Line 32 contains the word 'further'. The word is used as an adverb in the sentence. Which other adverb is used in the same paragraph (lines 31-34)?",
    options: {},
    correct_answer: 'increasingly',
    explanation: "Many adverbs have -ly ending. Adverbs can describe adjectives: increasingly concerned."
  },
  {
    subject: 'English', topic: 'comprehension_fr', question_type: 'Comprehension_FR',
    passage: PASSAGE_WATCHER,
    question_text: "Which one part of speech are the following as they appear in the passage? glimpse (line 1), unease (line 8), shoulder (line 30), behaviour (line 31)",
    options: {},
    correct_answer: 'noun',
    explanation: "Glimpse is a noun (preceded by 'a'). Unease, shoulder and behaviour are also nouns in this context — they are all things."
  },

  // ── MATHS MC Q29-50 ───────────────────────────────────────────────────────
  {
    subject: 'Maths', topic: 'arithmetic', question_type: 'Multiple_Choice',
    question_text: "At a school assembly there are 117 girls. There are 19 fewer boys than girls at the assembly. How many children are at the assembly altogether?",
    options: { A: "98", B: "136", C: "205", D: "209", E: "215" },
    correct_answer: 'E',
    explanation: "Two calculations: 117 - 19 = 98 (boys). Then 117 + 98 = 215."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Multiple_Choice',
    question_text: "Angle A and Angle B combine to make a right angle. Angle B measures 35°. What is the size of Angle A?",
    options: { A: "45°", B: "55°", C: "65°", D: "70°", E: "90°" },
    correct_answer: 'B',
    explanation: "A right angle is exactly 90°. If B is 35° then A must be 55° (90° - 35° = 55°)."
  },
  {
    subject: 'Maths', topic: 'fractions_decimals', question_type: 'Multiple_Choice',
    question_text: "Each of five shapes has had a fraction of its parts shaded. Shape A is a 4×7 grid with 8 squares shaded. Which of the shapes has NOT had one quarter of its parts shaded?",
    options: { A: "Shape A", B: "Shape B", C: "Shape C", D: "Shape D", E: "Shape E" },
    correct_answer: 'A',
    explanation: "Shape A has 28 squares (4×7) but only 8 are shaded. 8 is not one-quarter of 28 (one quarter would be 7)."
  },
  {
    subject: 'Maths', topic: 'arithmetic', question_type: 'Multiple_Choice',
    question_text: "Shauna writes out every factor for the numbers 12 and 16. How many factors do these two numbers share in common?",
    options: { A: "0", B: "1", C: "2", D: "3", E: "4" },
    correct_answer: 'D',
    explanation: "Factors of 12: 1,2,3,4,6,12. Factors of 16: 1,2,4,8,16. Shared factors are 1, 2 and 4 — that is 3 factors."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Multiple_Choice',
    question_text: "A cuboid has a volume of 90cm³. The front and back faces of the cuboid are squares. One edge measures 10cm. What is the measurement of the edge labelled with a question mark (the square face edge)?",
    options: { A: "2.25cm", B: "3cm", C: "4.5cm", D: "9cm", E: "10cm" },
    correct_answer: 'B',
    explanation: "The two missing sides are equal (square face). □ × □ × 10 = 90, so □² = 9, meaning □ = 3cm."
  },
  {
    subject: 'Maths', topic: 'arithmetic', question_type: 'Multiple_Choice',
    question_text: "A number is the sum of 6 tens, 3 ten thousands and 8 tenths. What is this number?",
    options: { A: "30140", B: "1090", C: "30006.8", D: "30060.8", E: "3060.8" },
    correct_answer: 'D',
    explanation: "6 tens = 60; 3 ten thousands = 30000; 8 tenths = 0.8. Sum: 60 + 30000 + 0.8 = 30060.8."
  },
  {
    subject: 'Maths', topic: 'fractions_decimals', question_type: 'Multiple_Choice',
    question_text: "What is 75% of 500?",
    options: { A: "75", B: "125", C: "250", D: "375", E: "425" },
    correct_answer: 'D',
    explanation: "75% = three quarters. 500 ÷ 4 = 125. 125 × 3 = 375."
  },
  {
    subject: 'Maths', topic: 'measurement', question_type: 'Multiple_Choice',
    question_text: "A school concert begins at 6.45pm. There are four performances of 12 minutes each with 5-minute breaks between each performance. At what time will the concert finish?",
    options: { A: "7.33pm", B: "7.45pm", C: "7.48pm", D: "7.53pm", E: "7.38pm" },
    correct_answer: 'C',
    explanation: "4 performances = 48 minutes. 3 breaks = 15 minutes. Total = 63 minutes. 6.45pm + 1 hour 3 minutes = 7.48pm."
  },
  {
    subject: 'Maths', topic: 'arithmetic', question_type: 'Multiple_Choice',
    question_text: "Jack buys two energy drinks at £1.65 each and a packet of cheese strings at 89p. He pays with a £5 note. What is the fewest number of coins he can receive in change?",
    options: { A: "2 coins", B: "3 coins", C: "4 coins", D: "5 coins", E: "6 coins" },
    correct_answer: 'C',
    explanation: "£1.65 × 2 = £3.30, plus 89p = £4.19. Change = 81p. Fewest coins: 50p, 20p, 10p, 1p = 4 coins."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Multiple_Choice',
    question_text: "Leah finds the sum of three acute angles. Which of these five outcomes is NOT possible?",
    options: { A: "The sum could make an acute angle.", B: "The sum could make a right angle.", C: "The sum could make an obtuse angle.", D: "The sum could make a reflex angle.", E: "The sum could make a full turn." },
    correct_answer: 'E',
    explanation: "Three acute angles are each less than 90°, so their sum is less than 270°. A full turn is 360°, which cannot be reached."
  },
  {
    subject: 'Maths', topic: 'statistics', question_type: 'Multiple_Choice',
    question_text: "72 people were asked which make of car they drove. The results are shown in a pie chart. Audi has 18 people. Which car has an angle on the pie chart that measures 45°?",
    options: { A: "Audi", B: "BMW", C: "Ford", D: "Kia", E: "VW" },
    correct_answer: 'B',
    explanation: "45° is half a right angle, which is one-eighth of 360°. One-eighth of 72 = 9. Audi has 18, so BMW with 9 people gives 45°."
  },
  {
    subject: 'Maths', topic: 'fractions_decimals', question_type: 'Multiple_Choice',
    question_text: "The distance to West City is five sevenths of the distance to East City. East City is 43.4km away. What is the distance to West City?",
    options: { A: "6.2km", B: "8.68km", C: "31km", D: "60.76km", E: "217km" },
    correct_answer: 'C',
    explanation: "43.4 ÷ 7 = 6.2. Then 6.2 × 5 = 31km."
  },
  {
    subject: 'Maths', topic: 'arithmetic', question_type: 'Multiple_Choice',
    question_text: "From the numbers 16, 49, 72, 81, 100: how many are square numbers that are ALSO divisible by 4?",
    options: { A: "1 number", B: "2 numbers", C: "3 numbers", D: "4 numbers", E: "5 numbers" },
    correct_answer: 'B',
    explanation: "Square numbers: 16, 49, 81, 100. Of these, 16 (÷4=4) and 100 (÷4=25) are divisible by 4. That is 2 numbers."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Multiple_Choice',
    question_text: "Five nets are shown (A–E). Which of these nets can be folded to make a cube?",
    options: { A: "Net B only", B: "Nets B, C and E only", C: "Nets A and C only", D: "Nets B and C only", E: "Nets B, C and D only" },
    correct_answer: 'D',
    explanation: "Net C is the most common working arrangement (1/4/1). 2×3 and 3×2 stair arrangements also work, making Net B possible."
  },
  {
    subject: 'Maths', topic: 'fractions_decimals', question_type: 'Multiple_Choice',
    question_text: "Which of the following numbers is smallest? 210.004, 201.04, 204.1, 204.01, 201.4",
    options: { A: "210.004", B: "201.04", C: "204.1", D: "204.01", E: "201.4" },
    correct_answer: 'B',
    explanation: "Compare B (201.04) and E (201.4): option B has 4 in the hundredths place, option E has 4 in the tenths place (bigger). So 201.04 is smallest."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Multiple_Choice',
    question_text: "A compound shape is a 20cm × 5cm rectangle with a 2cm × 5cm rectangle removed from the top-right corner. What is the area of this shape?",
    options: { A: "90cm²", B: "100cm²", C: "115cm²", D: "130cm²", E: "3000cm²" },
    correct_answer: 'A',
    explanation: "Full rectangle: 20 × 5 = 100cm². Missing piece: 2 × 5 = 10cm². 100 - 10 = 90cm²."
  },
  {
    subject: 'Maths', topic: 'measurement', question_type: 'Multiple_Choice',
    question_text: "Mr Jackson leaves home at 7.45am, arrives at the office 45 minutes later, stays until 12.30pm, takes lunch until 1.15pm, then works until leaving at 4.45pm (arriving home at 5.30pm after a 45-minute journey). For how long was Mr Jackson in his office on Monday?",
    options: { A: "7 hours 15 minutes", B: "7 hours 30 minutes", C: "8 hours 10 minutes", D: "8 hours 15 minutes", E: "9 hours 45 minutes" },
    correct_answer: 'B',
    explanation: "Arrives at 8.30am. In office until 12.30pm (4 hours). Returns 1.15pm, leaves 4.45pm (3.5 hours). Total: 7 hours 30 minutes."
  },
  {
    subject: 'Maths', topic: 'measurement', question_type: 'Multiple_Choice',
    question_text: "A thermometer shows 16°C in Florida at 3pm. At the same time in Stockholm it is 20 degrees colder. What is the temperature in Stockholm?",
    options: { A: "-2°C", B: "-4°C", C: "-6°C", D: "-12°C", E: "-14°C" },
    correct_answer: 'B',
    explanation: "Each interval on the scale is 2°C. Florida is 16°C. 16 - 20 = -4°C."
  },
  {
    subject: 'Maths', topic: 'algebra_sequences', question_type: 'Multiple_Choice',
    question_text: "What is the mean of all the prime numbers between 20 and 30?",
    options: { A: "21", B: "23", C: "24", D: "26", E: "29" },
    correct_answer: 'D',
    explanation: "Prime numbers between 20 and 30: 23 and 29. Sum = 52. Mean = 52 ÷ 2 = 26."
  },
  {
    subject: 'Maths', topic: 'arithmetic', question_type: 'Multiple_Choice',
    question_text: "Martha and her brother saved £90 altogether. Martha saved £12 more than her brother. How much did Martha's brother save?",
    options: { A: "£12", B: "£33", C: "£39", D: "£51", E: "£78" },
    correct_answer: 'C',
    explanation: "If brother = £39, Martha = £51 (£12 more). £39 + £51 = £90. ✓"
  },
  {
    subject: 'Maths', topic: 'fractions_decimals', question_type: 'Multiple_Choice',
    question_text: "Which of these fractions is equal to 5/6? Options: 40/48, 30/42, 25/36, 20/24, 15/18",
    options: { A: "40/48", B: "30/42", C: "25/36", D: "20/24", E: "15/18" },
    correct_answer: 'A',
    explanation: "40/48: both divide by 8 to give 5/6. Check: 5×8=40, 6×8=48. ✓"
  },
  {
    subject: 'Maths', topic: 'algebra_sequences', question_type: 'Multiple_Choice',
    question_text: "Shapes are arranged in a growing pattern. Shape 1 has 10 squares (2×5), Shape 2 has 18 squares (3×6), Shape 3 has 28 squares (4×7). How many squares will there be in Shape 4?",
    options: { A: "36 squares", B: "38 squares", C: "45 squares", D: "42 squares", E: "40 squares" },
    correct_answer: 'E',
    explanation: "The pattern is (n+1)×(n+4). Shape 4 = 5×8 = 40 squares."
  },

  // ── MATHS FR Q51-56 ───────────────────────────────────────────────────────
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Free_Response',
    question_text: "A triangle has a base of 8cm and a height of 11cm. What is the area of this triangle? Give your answer in cm².",
    options: {},
    correct_answer: '44',
    explanation: "Area of a triangle = base × height ÷ 2. 8 × 11 = 88. 88 ÷ 2 = 44cm²."
  },
  {
    subject: 'Maths', topic: 'fractions_decimals', question_type: 'Free_Response',
    question_text: "Five numbers are shown: 1.031, 1.3, 1.013, 1.31, 1.301. Multiply the largest of these five numbers by 1000.",
    options: {},
    correct_answer: '1310',
    explanation: "1.31 is the largest. Compare tenths digit: 1.31 and 1.3 both have 3 tenths, but 1.31 has 1 hundredth. 1.31 × 1000 = 1310."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Free_Response',
    question_text: "A square has sides of 12cm. A rectangle has a width of 6cm and its area is one third of the area of the square. What is the perimeter of the rectangle? Give your answer in cm.",
    options: {},
    correct_answer: '28',
    explanation: "Area of square = 144cm². Rectangle area = 48cm². Missing length = 48 ÷ 6 = 8cm. Perimeter = 8+8+6+6 = 28cm."
  },
  {
    subject: 'Maths', topic: 'geometry', question_type: 'Free_Response',
    question_text: "What is the combined number of edges on a square-based pyramid and a triangular prism?",
    options: {},
    correct_answer: '17',
    explanation: "Square-based pyramid has 8 edges. Triangular prism has 9 edges. 8 + 9 = 17 edges."
  },
  {
    subject: 'Maths', topic: 'statistics', question_type: 'Free_Response',
    question_text: "A line graph shows visitors to a leisure centre. Wednesday had 224 visitors and Thursday had 252 visitors. How many more visitors were there on Thursday than on Wednesday?",
    options: {},
    correct_answer: '28',
    explanation: "Each interval on the y-axis is worth 4 visitors. Thursday: 252. Wednesday: 224. Difference: 252 - 224 = 28 visitors."
  },
  {
    subject: 'Maths', topic: 'measurement', question_type: 'Free_Response',
    question_text: "A barrel contains 20kg of coffee beans. These are put into containers that hold 1500g each. How many containers can be completely filled?",
    options: {},
    correct_answer: '13',
    explanation: "1500g = 1.5kg. Count in 1.5s without exceeding 20: 1.5, 3, 4.5... 19.5 (13 times). The 14th container would not be full."
  },
];

async function main() {
  console.log(`\nInserting ${QUESTIONS.length} Catapult Test 1 questions into Supabase...\n`);

  const rows = QUESTIONS.map((q, i) => ({
    subject:        q.subject,
    topic:          q.topic,
    year_group:     'P7',
    difficulty:     3,
    question_type:  q.question_type,
    question_text:  q.question_text,
    passage:        q.passage || null,
    options:        q.options,
    correct_answer: q.correct_answer,
    explanation:    q.explanation,
    validated:      false,
    source:         'catapult_test',
  }));

  // Insert in batches of 10
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 10) {
    const batch = rows.slice(i, i + 10);
    const { data, error } = await sb.from('questions').insert(batch).select('id');
    if (error) {
      console.error(`  ✗ Error inserting batch ${i/10 + 1}:`, error.message);
    } else {
      inserted += data.length;
      console.log(`  ✓ Inserted rows ${i+1}–${i+batch.length} (${data.length} rows)`);
    }
  }

  console.log(`\n✅ Done — inserted ${inserted} / ${rows.length} rows`);
  console.log('   source = catapult_test, validated = false');
  console.log('   Delete with: DELETE FROM questions WHERE source = \'catapult_test\';\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
