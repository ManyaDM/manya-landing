export function gql(strings, ...args) {
  let str = "";
  strings.forEach((string, i) => {
    str += string + (args[i] || "");
  });
  return str;
}
export const HeroPartsFragmentDoc = gql`
    fragment HeroParts on Hero {
  __typename
  eyebrow
  title
  accentBlue
  accentRose
  sub1
  sub2
  ctaPrimary
  ctaSecondary
  stats {
    __typename
    number
    suffix
    label
  }
}
    `;
export const ServicePartsFragmentDoc = gql`
    fragment ServiceParts on Service {
  __typename
  slug
  name
  tag
  desc
  iconKey
  order
}
    `;
export const TestimonialPartsFragmentDoc = gql`
    fragment TestimonialParts on Testimonial {
  __typename
  name
  role
  metric
  logo
  text
  order
}
    `;
export const PainCardPartsFragmentDoc = gql`
    fragment PainCardParts on PainCard {
  __typename
  title
  desc
  iconKey
  order
}
    `;
export const ResultPartsFragmentDoc = gql`
    fragment ResultParts on Result {
  __typename
  metricNumber
  metricPrefix
  metricSuffix
  label
  desc
  order
}
    `;
export const TechCardPartsFragmentDoc = gql`
    fragment TechCardParts on TechCard {
  __typename
  label
  name
  desc
  iconKey
  order
}
    `;
export const SistemaCardPartsFragmentDoc = gql`
    fragment SistemaCardParts on SistemaCard {
  __typename
  label
  name
  desc
  iconKey
  order
}
    `;
export const ProcesoStepPartsFragmentDoc = gql`
    fragment ProcesoStepParts on ProcesoStep {
  __typename
  num
  title
  desc
  tag
  active
  order
}
    `;
export const ContactPartsFragmentDoc = gql`
    fragment ContactParts on Contact {
  __typename
  sectionTitle
  sectionDesc
  tagline
  trustItems
  objectives
}
    `;
export const HeroDocument = gql`
    query hero($relativePath: String!) {
  hero(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...HeroParts
  }
}
    ${HeroPartsFragmentDoc}`;
export const HeroConnectionDocument = gql`
    query heroConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: HeroFilter) {
  heroConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...HeroParts
      }
    }
  }
}
    ${HeroPartsFragmentDoc}`;
export const ServiceDocument = gql`
    query service($relativePath: String!) {
  service(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...ServiceParts
  }
}
    ${ServicePartsFragmentDoc}`;
export const ServiceConnectionDocument = gql`
    query serviceConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: ServiceFilter) {
  serviceConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...ServiceParts
      }
    }
  }
}
    ${ServicePartsFragmentDoc}`;
export const TestimonialDocument = gql`
    query testimonial($relativePath: String!) {
  testimonial(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...TestimonialParts
  }
}
    ${TestimonialPartsFragmentDoc}`;
export const TestimonialConnectionDocument = gql`
    query testimonialConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: TestimonialFilter) {
  testimonialConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...TestimonialParts
      }
    }
  }
}
    ${TestimonialPartsFragmentDoc}`;
export const PainCardDocument = gql`
    query painCard($relativePath: String!) {
  painCard(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...PainCardParts
  }
}
    ${PainCardPartsFragmentDoc}`;
export const PainCardConnectionDocument = gql`
    query painCardConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: PainCardFilter) {
  painCardConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...PainCardParts
      }
    }
  }
}
    ${PainCardPartsFragmentDoc}`;
export const ResultDocument = gql`
    query result($relativePath: String!) {
  result(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...ResultParts
  }
}
    ${ResultPartsFragmentDoc}`;
export const ResultConnectionDocument = gql`
    query resultConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: ResultFilter) {
  resultConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...ResultParts
      }
    }
  }
}
    ${ResultPartsFragmentDoc}`;
export const TechCardDocument = gql`
    query techCard($relativePath: String!) {
  techCard(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...TechCardParts
  }
}
    ${TechCardPartsFragmentDoc}`;
export const TechCardConnectionDocument = gql`
    query techCardConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: TechCardFilter) {
  techCardConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...TechCardParts
      }
    }
  }
}
    ${TechCardPartsFragmentDoc}`;
export const SistemaCardDocument = gql`
    query sistemaCard($relativePath: String!) {
  sistemaCard(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...SistemaCardParts
  }
}
    ${SistemaCardPartsFragmentDoc}`;
export const SistemaCardConnectionDocument = gql`
    query sistemaCardConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: SistemaCardFilter) {
  sistemaCardConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...SistemaCardParts
      }
    }
  }
}
    ${SistemaCardPartsFragmentDoc}`;
export const ProcesoStepDocument = gql`
    query procesoStep($relativePath: String!) {
  procesoStep(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...ProcesoStepParts
  }
}
    ${ProcesoStepPartsFragmentDoc}`;
export const ProcesoStepConnectionDocument = gql`
    query procesoStepConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: ProcesoStepFilter) {
  procesoStepConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...ProcesoStepParts
      }
    }
  }
}
    ${ProcesoStepPartsFragmentDoc}`;
export const ContactDocument = gql`
    query contact($relativePath: String!) {
  contact(relativePath: $relativePath) {
    ... on Document {
      _sys {
        filename
        basename
        hasReferences
        breadcrumbs
        path
        relativePath
        extension
      }
      id
    }
    ...ContactParts
  }
}
    ${ContactPartsFragmentDoc}`;
export const ContactConnectionDocument = gql`
    query contactConnection($before: String, $after: String, $first: Float, $last: Float, $sort: String, $filter: ContactFilter) {
  contactConnection(
    before: $before
    after: $after
    first: $first
    last: $last
    sort: $sort
    filter: $filter
  ) {
    pageInfo {
      hasPreviousPage
      hasNextPage
      startCursor
      endCursor
    }
    totalCount
    edges {
      cursor
      node {
        ... on Document {
          _sys {
            filename
            basename
            hasReferences
            breadcrumbs
            path
            relativePath
            extension
          }
          id
        }
        ...ContactParts
      }
    }
  }
}
    ${ContactPartsFragmentDoc}`;
export function getSdk(requester) {
  return {
    hero(variables, options) {
      return requester(HeroDocument, variables, options);
    },
    heroConnection(variables, options) {
      return requester(HeroConnectionDocument, variables, options);
    },
    service(variables, options) {
      return requester(ServiceDocument, variables, options);
    },
    serviceConnection(variables, options) {
      return requester(ServiceConnectionDocument, variables, options);
    },
    testimonial(variables, options) {
      return requester(TestimonialDocument, variables, options);
    },
    testimonialConnection(variables, options) {
      return requester(TestimonialConnectionDocument, variables, options);
    },
    painCard(variables, options) {
      return requester(PainCardDocument, variables, options);
    },
    painCardConnection(variables, options) {
      return requester(PainCardConnectionDocument, variables, options);
    },
    result(variables, options) {
      return requester(ResultDocument, variables, options);
    },
    resultConnection(variables, options) {
      return requester(ResultConnectionDocument, variables, options);
    },
    techCard(variables, options) {
      return requester(TechCardDocument, variables, options);
    },
    techCardConnection(variables, options) {
      return requester(TechCardConnectionDocument, variables, options);
    },
    sistemaCard(variables, options) {
      return requester(SistemaCardDocument, variables, options);
    },
    sistemaCardConnection(variables, options) {
      return requester(SistemaCardConnectionDocument, variables, options);
    },
    procesoStep(variables, options) {
      return requester(ProcesoStepDocument, variables, options);
    },
    procesoStepConnection(variables, options) {
      return requester(ProcesoStepConnectionDocument, variables, options);
    },
    contact(variables, options) {
      return requester(ContactDocument, variables, options);
    },
    contactConnection(variables, options) {
      return requester(ContactConnectionDocument, variables, options);
    }
  };
}
import { createClient } from "tinacms/dist/client";
const generateRequester = (client) => {
  const requester = async (doc, vars, options) => {
    let url = client.apiUrl;
    if (options?.branch) {
      const index = client.apiUrl.lastIndexOf("/");
      url = client.apiUrl.substring(0, index + 1) + options.branch;
    }
    const data = await client.request({
      query: doc,
      variables: vars,
      url
    }, options);
    return { data: data?.data, errors: data?.errors, query: doc, variables: vars || {} };
  };
  return requester;
};
export const ExperimentalGetTinaClient = () => getSdk(
  generateRequester(
    createClient({
      url: "http://localhost:4001/graphql",
      queries
    })
  )
);
export const queries = (client) => {
  const requester = generateRequester(client);
  return getSdk(requester);
};
