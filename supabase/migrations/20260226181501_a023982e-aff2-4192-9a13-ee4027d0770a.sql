
-- Set English programs to EN
UPDATE programs SET country = 'EN' WHERE id IN (
  'ee9aea8b-f1b9-4b62-b562-5e91745f4bca',
  '0bb22606-bdc2-41d2-b132-6d1473a7f2ce',
  '3883ec61-290c-445a-b354-21a983c920b6',
  '26011b1a-9421-4610-917c-a023d0e67b60',
  '3283fc57-7c6d-49c5-b0a3-2b1e8c49ce4d',
  '9b13a5c0-ac80-4d07-a29f-68f08589692d',
  '92cbf211-164b-419c-afdf-6a1ac3941999',
  'c39a596d-80cd-4c44-99c6-b0e2782f9de1'
);

-- Set Finnish programs to FI
UPDATE programs SET country = 'FI' WHERE id IN (
  'ab96d870-f58b-4e3f-a4f8-a34e69a629a2',
  '01c7a13c-2ab1-469e-99da-a0382ba7fbcf',
  'e734740a-aa30-47af-b0a7-7c40912f9ca8'
);
