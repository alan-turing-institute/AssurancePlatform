import { useEffect, useState } from 'react';
import type { AssuranceCase } from '@/types/domain';

interface PublicCaseViewMockProps {
  caseId: number;
}

export const PublicCaseViewMock = ({ caseId }: PublicCaseViewMockProps) => {
  const [caseData, setCaseData] = useState<AssuranceCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/public/assurance-case/${caseId}/`
        );
        const data = await response.json();
        setCaseData(data);
      } catch (_error) {
        // Failed to fetch case
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
  }, [caseId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!caseData) {
    return <div>Case not found</div>;
  }

  return (
    <div>
      <h1>{caseData.name}</h1>
      <p>{caseData.description}</p>

      <button
        aria-label="Create case study"
        onClick={() => {
          // Show modal dialog
          const dialog = document.createElement('div');
          dialog.setAttribute('role', 'dialog');
          dialog.innerHTML = `
            <h2>Create Case Study</h2>
            <form id="case-study-form">
              <label>
                Title
                <input type="text" name="title" aria-label="Title" />
              </label>
              <label>
                Description
                <textarea name="description" aria-label="Description"></textarea>
              </label>
              <button type="submit" aria-label="Create">Create</button>
            </form>
          `;

          document.body.appendChild(dialog);

          const form = dialog.querySelector('form');
          form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);

            try {
              const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/case-studies/`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: 'Token mock-jwt-token',
                  },
                  body: formData,
                }
              );

              if (response.ok) {
                const result = await response.json();
                const successMsg = document.createElement('div');
                successMsg.textContent = 'Case study created successfully';
                document.body.appendChild(successMsg);

                // Simulate navigation
                window.history.pushState(
                  {},
                  '',
                  `/dashboard/case-studies/${result.id}`
                );
              }
            } catch (_error) {
              // Failed to create case study
            }
          });
        }}
        type="button"
      >
        Create Case Study
      </button>

      {/* Display public case information */}
      {caseData.goals && (
        <div>
          <h2>Goals</h2>
          {caseData.goals.map((goal) => (
            <div key={goal.id}>{goal.name}</div>
          ))}
        </div>
      )}
    </div>
  );
};
