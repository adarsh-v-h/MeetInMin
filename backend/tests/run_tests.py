import asyncio
import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.test_zoho_pipeline import test_zoho_auth_token, test_zoho_stt_transcription, test_zoho_glm_insights

async def main():
    print("🧪 Running Zoho Pipeline Test Suite...")
    
    print("\n1. Testing Zoho OAuth Token Refresh...")
    await test_zoho_auth_token()
    print("✅ OAuth Token Test PASSED!")
    
    print("\n2. Testing Zoho Speech-to-Text Transcription...")
    await test_zoho_stt_transcription()
    print("✅ Speech-to-Text Test PASSED!")
    
    print("\n3. Testing Zoho GLM Structured Insight Extraction...")
    await test_zoho_glm_insights()
    print("✅ Zoho GLM Test PASSED!")
    
    print("\n🎉 ALL ZOHO PIPELINE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
