"""
Dictionaries to be used in tests
"""

CASE1_INFO = {"name": "First Case", "description": "first test case", "lock_uuid": None}
CASE2_INFO = {
    "name": "Second Case",
    "description": "second test case",
    "lock_uuid": None,
}
CASE3_INFO = {"name": "Third Case", "description": "third test case", "lock_uuid": None}
GOAL_INFO = {
    "name": "The Goal",
    "short_description": "we should do this",
    "long_description": "A long description of what we should do",
    "keywords": "key",
    "assurance_case_id": 1,
}
CONTEXT_INFO = {
    "name": "Context",
    "short_description": "context for The Goal",
    "long_description": "A longer description of the context",
    "goal_id": 1,
}

PROPERTYCLAIM1_INFO = {
    "name": "PropertyClaim 1",
    "short_description": "Goal 1 should be x",
    "long_description": "A long description of this property claim",
    "goal_id": 1,
}
PROPERTYCLAIM2_INFO = {
    "name": "PropertyClaim 2",
    "short_description": "Goal 1 should probably be yz",
    "long_description": "A long description of this property claim",
    "goal_id": 1,
}
EVIDENTIALCLAIM1_INFO = {
    "name": "Evidential Claim 1",
    "short_description": "A short description of the first evidential claim",
    "long_description": "A longer description of the first evidential claim",
}
EVIDENTIALCLAIM2_INFO = {
    "name": "Evidential Claim 2",
    "short_description": "A short description of the second evidential claim",
    "long_description": "A longer description of the second evidential claim",
}
EVIDENTIALCLAIM3_INFO = {
    "name": "Evidential Claim 3",
    "short_description": "A short description of the third evidential claim",
    "long_description": "A longer description of the third evidential claim",
}
EVIDENTIALCLAIM4_INFO = {
    "name": "Evidential Claim 4",
    "short_description": "A short description of the fourth evidential claim",
    "long_description": "A longer description of the fourth evidential claim",
}
EVIDENCE1_INFO = {
    "name": "Evidence 1",
    "short_description": "Some evidence to support claim 1",
    "long_description": "Description of that evidence",
    "URL": "http://evidence1.com",
    "evidential_claim_id": [1],
}
EVIDENCE2_INFO = {
    "name": "Evidence 2",
    "short_description": "Some more evidence to support claim 1",
    "long_description": "Description of that evidence",
    "URL": "http://evidence2.com",
    "evidential_claim_id": [1],
}
EVIDENCE1_INFO_NO_ID = {
    "name": "Evidence 1",
    "short_description": "Some evidence to support claim 1",
    "long_description": "Description of that evidence",
    "URL": "http://evidence1.com",
}
EVIDENCE2_INFO_NO_ID = {
    "name": "Evidence 2",
    "short_description": "Some more evidence to support claim 1",
    "long_description": "Description of that evidence",
    "URL": "http://evidence2.com",
}
EVIDENCE3_INFO = {
    "name": "Evidence 3",
    "short_description": "Some evidence to support claim 2",
    "long_description": "Description of that evidence",
    "URL": "http://evidence3.com",
    "evidential_claim_id": [2],
}
EVIDENCE4_INFO = {
    "name": "Evidence 4",
    "short_description": "Some more evidence to support claim 2",
    "long_description": "Description of that evidence",
    "URL": "http://evidence4.com",
    "evidential_claim_id": [2],
}
EVIDENCE5_INFO = {
    "name": "Evidence 5",
    "short_description": "Some evidence to support claim 3",
    "long_description": "Description of that evidence",
    "URL": "http://evidence5.com",
    "evidential_claim_id": [3],
}
EVIDENCE6_INFO = {
    "name": "Evidence 6",
    "short_description": "Some more evidence to support claim 3",
    "long_description": "Description of that evidence",
    "URL": "http://evidence6.com",
    "evidential_claim_id": [3],
}
EVIDENCE7_INFO = {
    "name": "Evidence 7",
    "short_description": "Some more evidence to support claim 4",
    "long_description": "Description of that evidence",
    "URL": "http://evidence7.com",
    "evidential_claim_id": [4],
}
USER1_INFO = {
    "username": "testUser1",
    "email": "test1@user.com",
    "password": "pa55w0rd531",
}
USER2_INFO = {
    "username": "testUser2",
    "email": "test2@user.com",
    "password": "pa55w0rd642",
}
USER3_INFO = {
    "username": "testUser3",
    "email": "test3@user.com",
    "password": "567pa55w0rd",
}
GROUP1_INFO = {
    "name": "testGroup1",
}
GROUP2_INFO = {
    "name": "testGroup2",
}
GROUP3_INFO = {
    "name": "testGroup3",
}
