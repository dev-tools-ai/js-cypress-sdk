describe(
  'findbyai',
  {
    retries: {
      runMode: 0,
      openMode: 0,
    },
  },
  () => {
    it('Can find the username field using a human readable name and not a selector', () => {
      cy.visit('https://github.com/login');

      cy.findByAI('password field').should('be.visible').type('some password');
    });
  },
);
