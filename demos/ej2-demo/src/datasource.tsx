export let data: object[] = [{
  'Id': 'parent',
  'Name': 'Maria Anders',
  'Designation': 'Managing Director',
  'IsExpand': 'true',
  'RatingColor': '#C34444'
},
{
  'Id': 1,
  'Name': 'Ana Trujillo',
  'Designation': 'Project Manager',
  'IsExpand': 'false',
  'RatingColor': '#68C2DE',
  'ReportingPerson': 'parent'
},
{
  'Id': 2,
  'Name': 'Anto Moreno',
  'Designation': 'Project Lead',
  'IsExpand': 'false',
  'RatingColor': '#93B85A',
  'ReportingPerson': 'parent',
},
{
  'Id': 3,
  'Name': 'Thomas Hardy',
  'Designation': 'Senior S/w Engg',
  'IsExpand': 'false',
  'RatingColor': '#68C2DE',
  'ReportingPerson': 1
},
{
  'Id': 4,
  'Name': 'Christina kaff',
  'Designation': 'S/w Engg',
  'IsExpand': 'false',
  'RatingColor': '#93B85A',
  'ReportingPerson': 2
},
{
  'Id': 5,
  'Name': 'Hanna Moos',
  'Designation': 'Project Trainee',
  'IsExpand': 'true',
  'RatingColor': '#D46E89',
  'ReportingPerson': 2
}];
