"""
Context builder for LLM prompts.
"""


class ContextBuilder:
    """
    Converts retrieved chunks into a compact context string.
    """

    @staticmethod
    def build(
        documents: list[dict],
    ) -> str:

        sections = []

        for doc in documents:

            sections.append(
                f"""### {doc["title"]}

{doc["content"]}
"""
            )

        return "\n\n".join(sections)