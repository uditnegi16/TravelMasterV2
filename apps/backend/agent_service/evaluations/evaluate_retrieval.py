import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from retrieval.retriever import SemanticRetriever

retriever = SemanticRetriever()

dataset_path = Path(__file__).parent / "test_dataset.json"

with open(dataset_path, "r", encoding="utf-8") as f:
    dataset = json.load(f)

total = len(dataset)
passed = 0

print("=" * 60)
print("TravelMaster Retrieval Evaluation")
print("=" * 60)

for test in dataset:

    docs = retriever.search(test["query"])

    context = " ".join(doc["content"] for doc in docs).lower()

    matched = sum(
        keyword.lower() in context
        for keyword in test["expected_keywords"]
    )

    score = matched / len(test["expected_keywords"])

    if score >= 0.5:
        passed += 1
        status = "PASS"
    else:
        status = "FAIL"

    print(f"\n[{status}] {test['query']}")
    print(
        f"Matched {matched}/{len(test['expected_keywords'])}"
    )

print("\n" + "=" * 60)
print(f"Passed : {passed}/{total}")
print(f"Coverage: {(passed/total)*100:.2f}%")
print("=" * 60)