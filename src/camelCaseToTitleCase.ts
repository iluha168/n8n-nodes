export const camelCaseToTitleCase = (camelCase: string) => {
	const tmp = camelCase.replace(/([A-Z])/g, " $1");
	return tmp.charAt(0).toUpperCase() + tmp.slice(1);
};
