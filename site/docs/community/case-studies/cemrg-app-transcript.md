# Transcript from video

Hello and welcome to our presentation showcasing the work of the Cardiac Electromechanics research Group CEMRG at Imperial College London as a case study for the TEA platform.

Today we are excited to delve into one of our flagship projects, the CemrgApp, which is revolutionising the way we analyse cardiovascular data.

Jose and I are members of CEMRG at Imperial College.

Our research group applies statistical, machine learning and simulation approaches to study the physiology, pathophysiology, diagnosis, and treatment of the heart.

We are an inherently interdisciplinary research group, bringing together mathematicians, engineers, statisticians, experimental researchers and clinicians.

The combination of technical expertise and clinical insight makes CEMRG uniquely positioned to drive translational research and make a real impact in the field of cardiovascular medicine.

Now we turn our attention to the innovative tool that is at the forefront of our efforts, the scar quantification tool or SQT.

Within the CemrgApp platform, expect to learn the importance of scar identification and how it is performed, the role of the SQT in analysing scar tissue in the heart and how it works.

The fairness assurance analysis made for the SQT and how fairness claims were chosen and backed.

Scar tissue in the heart can lead to serious complications such as such as abnormal heart rhythms, making accurate identification paramount for effective diagnosis and treatment.

Identifying scar tissue accurately can help clinicians make informed decisions and improve patient outcomes.

The only non invasive tool to assess scar tissue is through an advanced 3D imaging technology known as Late Gadolinium Enhanced Cardiac Magnetic Resonance or LGE-CMR to identify scar tissue in the heart in which scar tissue appears brighter than normal healthy tissue.

Manually assessing these scans can vary depending on the operator.

The main focus of this case study is the Scar Quantification tool, or SQT, within the similar job platform.

This tool is a crucial component of our efforts to analyse the scar tissue in the heart.

It enables us to visualise and validate the steps required for accurate quantification of scar tissue.

Now let's delve into how the SQT works.

Taking an LGE-CMR scan as input, the tool goes through three main phases.

One, segmentation to isolate the left atrium within the heart, 2 generating a 3D representation of its geometry, and then three, creating a scar map based on the signal intensity from the LGE scan.

The user design presents several push buttons, sequentially numbered to present steps in the workflow, which are then visualised within the same user interface.

In the video, we can see the later stages of the process where a 3D model is created with different colors to indicate the amount of scar tissue per region.

Fairness assurance is crucial for ensuring that the SQT operates ethically and accurately.

In this case study, we have considered factors such as bias, mitigation, diversity, and inclusivity.

CemrgApp in general is tailored to patient specific workflows where the physiological data corresponds to an individual.

While this brings many opportunities for personalised healthcare, it also carries risks, most notably the possible risk of unequal performance for individuals or subgroups of the population.

Therefore, it is worth considering how such risk can be identified, evaluated and mitigated.

Alongside the Turing team, we approach the development of an insurance case for the SQT using the following general approach.

First we explored a general understanding of a concept of fairness.

Then we consider different examples of practical fairness issues that are present and use court attributes of fairness as strategies for identifying exemplary claims and evidence for a draft assurance case.

This became an introspection exercise of our software which provided us with a snapshot of our project with regards to fairness, its strengths, shortcomings and possibilities for future development.

We settled on the following core attributes and the impact in the project bias mitigation across the project life cycle, diversity and inclusivity for project governance, non discrimination in model outcomes and equitable impact of the system.

Our bias mitigation claim is that the SQT reduces undesirable operator variability to limit the impact of cognitive biases when using the image processing pipeline and chosen thresholds.

Standardising analysis methods and providing specific threshold backed by the relevant literature are essential steps in ensuring that clinical decisions are driven by objective data rather than individual interpretations.

It's essential for the SQT to engage patients and healthcare professionals for more backgrounds.

The tool promotes special engagement and interactive decision making through accessible visualisations, making healthcare more inclusive for everyone.

Our claim about this is that the tool supports special engagement and interactive decision making through accessible and informative visualisations and that the user interface and dashboard are intuitive and follow the best practices for presentation of information.

Regards with adequatable impact, the tool is open source and easily accessible to allow clinicians to run software and the tool is efficient in terms of computational resources allowing for widespread use.

Ensuring equitable impact is another key goal of the SQT.

By being open source and efficient in terms of resources, the tool can reach more healthcare providers and ultimately benefit more patients.

Non discrimination is paramount in the development of the SQT.

With deep learning techniques and careful validation, we are working to minimise biases and ensure fairness in the analysis process.

For this, our claim claim is that the tool does not discriminate across different patient groups and ensures quality and consistency of the roles across users with different level of training.

Finally, let's address the challenges and limitations we face in ensuring fairness assurance for the SQT.

While we've made significant progress, there are still hurdles to overcome such as user engagement and validation across different demographics.
But rest assured, we're committed to continuous improvement and ensuring that the SQT operates ethnically and fairly for all patients.

As we conclude today's presentation, it is crucial to recognise that advancement in tools like the Scar Quantification Tool are pivotal for improving patient outcomes and ensuring fairness and equity in healthcare.

Indeed, by prioritising accuracy, inclusivity and fairness in our analysis processes, we are not only advancing cardiovascular medicine, but also fostering a more equitable future in healthcare.

Thank you for listening.
