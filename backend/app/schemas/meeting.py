from pydantic import BaseModel, Field
from typing import List, Optional

class ActionItem(BaseModel):
    task: str = Field(description="The specific action item or task to be completed.")
    assignee: str = Field(description="The person responsible for the task. Use 'Unassigned' if not mentioned.")

class MeetingInsights(BaseModel):
    summary: str = Field(description="A brief, executive summary of the overall meeting.")
    key_decisions: List[str] = Field(description="A list of key decisions that were made during the meeting.")
    action_items: List[ActionItem] = Field(description="A list of action items assigned to individuals.")
