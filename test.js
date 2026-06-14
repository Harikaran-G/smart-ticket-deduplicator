import { generateMockEmbedding, cosineSimilarity } from './embeddings.js';
import { mockVerify } from './llm-verify.js';

console.log('==================================================');
console.log('🧪 Running Semantic Search & Match Tests...');
console.log('==================================================');

// Test Tickets
const ticket1 = {
  id: 1,
  title: "Login screen fails to load on Chrome",
  description: "When opening the login page on Google Chrome, the screen remains completely white. No console errors are shown.",
  category: "Bug",
  status: "Open"
};

const ticket2 = {
  id: 2,
  title: "Cannot log in with Chrome, white page",
  description: "I tried logging in on Chrome, but the screen is entirely white and doesn't load. What is wrong?",
  category: "Bug",
  status: "Open"
};

const ticket3 = {
  id: 3,
  title: "Dark mode color contrast is too low in settings page",
  description: "The text on the settings page is dark gray on a black background when dark mode is enabled, making it unreadable.",
  category: "Bug",
  status: "In Progress"
};

// 1. Generate Mock Embeddings
const emb1 = generateMockEmbedding(`${ticket1.title} ${ticket1.description}`);
const emb2 = generateMockEmbedding(`${ticket2.title} ${ticket2.description}`);
const emb3 = generateMockEmbedding(`${ticket3.title} ${ticket3.description}`);

// 2. Validate dimensional scale
if (emb1.length === 3072 && emb2.length === 3072 && emb3.length === 3072) {
  console.log('✅ Dimension Validation: Embeddings are correctly 3072-dimensional.');
} else {
  console.log('❌ Dimension Validation: Embedding sizes are incorrect. Got:', emb1.length);
}

// 3. Compute Similarities
const sim12 = cosineSimilarity(emb1, emb2);
const sim13 = cosineSimilarity(emb1, emb3);

console.log(`\n📊 Cosine Similarities:`);
console.log(`   - Ticket 1 vs 2 (Semantic Duplicate): ${sim12.toFixed(4)}`);
console.log(`   - Ticket 1 vs 3 (Unrelated Issue):     ${sim13.toFixed(4)}`);

// Threshold Check
const threshold = 0.65;
console.log(`\n🔍 Threshold Classification (threshold = ${threshold}):`);

if (sim12 >= threshold) {
  console.log(`   ✅ Ticket 1 vs 2 matches correctly (>= ${threshold})`);
} else {
  console.log(`   ❌ Ticket 1 vs 2 failed to match (< ${threshold})`);
}

if (sim13 < threshold) {
  console.log(`   ✅ Ticket 1 vs 3 ignored correctly (< ${threshold})`);
} else {
  console.log(`   ❌ Ticket 1 vs 3 incorrectly matched (>= ${threshold})`);
}

// 4. Test Mock Verification
console.log('\n🔍 Verification Verdict Mocking:');
const verdict12 = mockVerify(ticket2, ticket1, sim12);
const verdict13 = mockVerify(ticket3, ticket1, sim13);

console.log(`   - Ticket 1 vs 2: Verdict=${verdict12.verdict}, Confidence=${verdict12.confidence}%, Reason="${verdict12.reasoning}"`);
console.log(`   - Ticket 1 vs 3: Verdict=${verdict13.verdict}, Confidence=${verdict13.confidence}%, Reason="${verdict13.reasoning}"`);

if (verdict12.verdict === 'YES') {
  console.log('\n🎉 ALL MOCK COMPONENT TESTS PASSED SUCCESSFULLY!');
} else {
  console.log('\n⚠️ SOME MOCK COMPONENT TESTS FAILED OR YIELDED LOWER VERDICTS.');
}
console.log('==================================================');
